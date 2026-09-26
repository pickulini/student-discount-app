import Foundation
import Security

// MARK: - Адрес сервера

enum AppConfig {
    /// Боевой сервер. Можно поменять на экране входа (долгое нажатие на логотип) —
    /// значение хранится в UserDefaults.
    /// Имя сервера в сети Tailscale: на него выпущен HTTPS-сертификат (HTTP/2, без предупреждений).
    static let defaultServer = "https://server.tailacb603.ts.net"
    /// Старые адреса того же сервера (до HTTPS) — если такой сохранён, используем новый.
    private static let legacyServers: Set<String> = ["http://100.71.89.81", "http://server.tailacb603.ts.net"]
    private static let key = "server_base_url"

    static var server: String {
        get {
            guard let v = UserDefaults.standard.string(forKey: key), !legacyServers.contains(v) else { return defaultServer }
            return v
        }
        set {
            let v = newValue.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            UserDefaults.standard.set(v.isEmpty ? nil : v, forKey: key)
        }
    }

    static var apiBase: URL { URL(string: server + "/api/v1")! }

    /// Картинки приходят относительными путями (/uploads/…) — достраиваем до полного URL.
    static func mediaURL(_ path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        if path.hasPrefix("http") { return URL(string: path) }
        return URL(string: server + (path.hasPrefix("/") ? path : "/" + path))
    }
}

// MARK: - Keychain

enum Keychain {
    private static let service = "com.studentdiscount.app"

    static func set(_ value: String?, for key: String) {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                   kSecAttrService as String: service,
                                   kSecAttrAccount as String: key]
        SecItemDelete(base as CFDictionary)
        guard let value, let data = value.data(using: .utf8) else { return }
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    static func get(_ key: String) -> String? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                kSecAttrService as String: service,
                                kSecAttrAccount as String: key,
                                kSecReturnData as String: true,
                                kSecMatchLimit as String: kSecMatchLimitOne]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }
}

// MARK: - Ошибки

enum APIError: LocalizedError {
    case unauthorized
    case server(Int, String)
    case network
    case decoding

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Сессия закончилась — войдите снова"
        case let .server(_, m): return m.isEmpty ? "Сервер ответил ошибкой" : APIError.humanize(m)
        case .network: return "Нет связи с сервером"
        case .decoding: return "Не удалось прочитать ответ сервера"
        }
    }

    var status: Int? { if case let .server(s, _) = self { return s } else { return nil } }

    /// Частые ошибки сервера — по-русски, как на сайте.
    static func humanize(_ m: String) -> String {
        let map: [String: String] = [
            "invalid credentials": "Неверный email или пароль",
            "email already exists": "Этот email уже зарегистрирован",
            "insufficient funds": "Недостаточно средств на кошельке",
            "password must be at least 8 characters": "Пароль — минимум 8 символов",
        ]
        for (k, v) in map where m.lowercased().contains(k) { return v }
        return m
    }
}

// MARK: - Клиент

/// Все запросы к Go-бэкенду. Access-токен живёт недолго (JWT_EXPIRY_MIN),
/// refresh-токен — 30 дней и продлевается при каждом обновлении. Клиент обновляет
/// access-токен заранее, а на 401 — обновляет и повторяет запрос один раз,
/// так что пользователя не выкидывает из аккаунта.
actor API {
    static let shared = API()

    private let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 25
        c.waitsForConnectivity = false
        return URLSession(configuration: c)
    }()

    private var refreshTask: Task<String?, Never>?

    /// В «Активных сессиях» приложение видно как «iPhone · Приложение».
    static let userAgent: String = {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        return "Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X) StudentDiscountApp/\(v)"
    }()

    /// Вызывается, когда сессия окончательно закончилась (refresh отклонён).
    nonisolated(unsafe) static var onSessionExpired: (() -> Void)?

    // MARK: токены

    static var accessToken: String? {
        get { Keychain.get("access_token") }
        set { Keychain.set(newValue, for: "access_token") }
    }

    static var refreshToken: String? {
        get { Keychain.get("refresh_token") }
        set { Keychain.set(newValue, for: "refresh_token") }
    }

    static func clearTokens() {
        accessToken = nil
        refreshToken = nil
    }

    private static func secondsLeft(_ token: String) -> Double? {
        let parts = token.split(separator: ".")
        guard parts.count > 1 else { return nil }
        var b = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while b.count % 4 != 0 { b += "=" }
        guard let d = Data(base64Encoded: b), let j = try? JSON(data: d), let exp = j.exp.double else { return nil }
        return exp - Date().timeIntervalSince1970
    }

    private func refresh() async -> String? {
        if let t = refreshTask { return await t.value }
        let t = Task<String?, Never> {
            guard let rt = API.refreshToken else { return nil }
            var req = URLRequest(url: AppConfig.apiBase.appendingPathComponent("auth/refresh"))
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": rt])
            guard let (data, resp) = try? await session.data(for: req), let http = resp as? HTTPURLResponse else {
                return API.accessToken // нет сети — оставляем как есть, не разлогиниваем
            }
            if http.statusCode == 200, let token = (try? JSON(data: data))?.access_token.string {
                API.accessToken = token
                return token
            }
            return http.statusCode == 401 ? nil : API.accessToken
        }
        refreshTask = t
        let v = await t.value
        refreshTask = nil
        return v
    }

    /// Токен для потока событий: он передаётся в URL, поэтому берём заведомо живой.
    func streamToken() async -> String? {
        guard let t = API.accessToken else { return nil }
        if let left = API.secondsLeft(t), left < 300, API.refreshToken != nil {
            return await refresh() ?? t
        }
        return t
    }

    private func freshToken() async -> String? {
        guard let t = API.accessToken else { return nil }
        if let left = API.secondsLeft(t), left < 60, API.refreshToken != nil {
            return await refresh() ?? t
        }
        return t
    }

    // MARK: запросы

    enum Body {
        case none
        case json(Any)
        case multipart(Data, filename: String, mime: String)
    }

    @discardableResult
    func request(_ method: String, _ path: String, query: [String: String] = [:], body: Body = .none, auth: Bool = true) async throws -> JSON {
        try await send(method, path, query: query, body: body, auth: auth, retried: false)
    }

    private func send(_ method: String, _ path: String, query: [String: String], body: Body, auth: Bool, retried: Bool) async throws -> JSON {
        var comps = URLComponents(url: AppConfig.apiBase.appendingPathComponent(path.hasPrefix("/") ? String(path.dropFirst()) : path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) } }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue(API.userAgent, forHTTPHeaderField: "User-Agent")
        if auth, let token = await freshToken() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        switch body {
        case .none: break
        case let .json(obj):
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try? JSONSerialization.data(withJSONObject: obj)
        case let .multipart(data, filename, mime):
            let boundary = "sd-\(UUID().uuidString)"
            req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
            var b = Data()
            b.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\nContent-Type: \(mime)\r\n\r\n".data(using: .utf8)!)
            b.append(data)
            b.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
            req.httpBody = b
        }

        let data: Data
        let http: HTTPURLResponse
        do {
            let (d, r) = try await session.data(for: req)
            guard let h = r as? HTTPURLResponse else { throw APIError.network }
            data = d
            http = h
        } catch let e as APIError {
            throw e
        } catch {
            throw APIError.network
        }

        if http.statusCode == 401, auth, !path.hasPrefix("auth/"), !path.hasPrefix("/auth/") {
            if !retried, API.refreshToken != nil, let _ = await refresh() {
                return try await send(method, path, query: query, body: body, auth: auth, retried: true)
            }
            API.clearTokens()
            if let cb = API.onSessionExpired { await MainActor.run { cb() } }
            throw APIError.unauthorized
        }

        let json = data.isEmpty ? JSON.null : ((try? JSON(data: data)) ?? .null)
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.server(http.statusCode, json.error.string ?? json.message.string ?? "")
        }
        return json
    }

    // MARK: сокращения

    @discardableResult func get(_ path: String, _ query: [String: String] = [:]) async throws -> JSON {
        try await request("GET", path, query: query)
    }

    @discardableResult func post(_ path: String, _ body: [String: Any]? = nil) async throws -> JSON {
        try await request("POST", path, body: body.map { .json($0) } ?? .none)
    }

    @discardableResult func put(_ path: String, _ body: [String: Any]) async throws -> JSON {
        try await request("PUT", path, body: .json(body))
    }

    @discardableResult func patch(_ path: String, _ body: [String: Any]) async throws -> JSON {
        try await request("PATCH", path, body: .json(body))
    }

    @discardableResult func delete(_ path: String) async throws -> JSON {
        try await request("DELETE", path)
    }

    /// Загрузка картинки (сервер принимает jpeg/png/gif/webp). Возвращает URL файла.
    func upload(_ jpeg: Data) async throws -> String {
        let r = try await request("POST", "users/upload-avatar", body: .multipart(jpeg, filename: "photo.jpg", mime: "image/jpeg"))
        return r.url.str
    }
}
