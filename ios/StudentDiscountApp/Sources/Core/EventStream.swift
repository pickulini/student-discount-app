import Foundation

/// Событие из потока /notifications/stream (как на сайте: support_message, notification…).
struct LiveEvent: Equatable {
    let id = UUID()
    let name: String
    let payload: JSON

    static func == (a: LiveEvent, b: LiveEvent) -> Bool { a.id == b.id }
}

/// Живой поток событий сервера (Server-Sent Events). Держит одно соединение,
/// сам переподключается с паузой 1→30 с и берёт свежий токен на каждое подключение.
@MainActor
final class EventStream {
    var onEvent: ((LiveEvent) -> Void)?
    var onConnected: (() -> Void)?

    private var task: Task<Void, Never>?
    private let urlSession: URLSession = {
        let cfg = URLSessionConfiguration.default
        // Сервер шлёт keep-alive каждые 25 с — ждём дольше, чтобы не рвать соединение зря.
        cfg.timeoutIntervalForRequest = 70
        cfg.timeoutIntervalForResource = 24 * 3600
        cfg.requestCachePolicy = .reloadIgnoringLocalCacheData
        cfg.urlCache = nil
        return URLSession(configuration: cfg)
    }()

    var isRunning: Bool { task != nil }

    func start() {
        guard task == nil else { return }
        task = Task { [weak self] in
            var delay: UInt64 = 1
            while !Task.isCancelled {
                let ok = await self?.runOnce() ?? false
                if Task.isCancelled { break }
                delay = ok ? 1 : min(delay * 2, 30)
                try? await Task.sleep(nanoseconds: delay * 1_000_000_000)
            }
        }
    }

    func stop() {
        task?.cancel()
        task = nil
    }

    /// Переподключиться сразу (например, приложение вернулось из фона).
    func restart() {
        stop()
        start()
    }

    /// Одно соединение. true — было успешное подключение (значит, пауза перед повтором короткая).
    private func runOnce() async -> Bool {
        guard let token = await API.shared.streamToken() else { return false }
        var comps = URLComponents(url: AppConfig.apiBase.appendingPathComponent("notifications/stream"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [URLQueryItem(name: "token", value: token)]
        guard let url = comps.url else { return false }
        var req = URLRequest(url: url)
        req.setValue("text/event-stream", forHTTPHeaderField: "Accept")

        var connected = false
        do {
            let (bytes, resp) = try await urlSession.bytes(for: req)
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else { return false }
            var event = "message"
            for try await line in bytes.lines {
                if Task.isCancelled { break }
                if line.hasPrefix("event:") {
                    event = line.dropFirst(6).trimmingCharacters(in: .whitespaces)
                } else if line.hasPrefix("data:") {
                    let raw = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
                    let payload = (try? JSON(data: Data(raw.utf8))) ?? .null
                    if event == "connected" {
                        connected = true
                        onConnected?()
                    } else {
                        onEvent?(LiveEvent(name: event, payload: payload))
                    }
                    event = "message"
                }
            }
        } catch {}
        return connected
    }
}
