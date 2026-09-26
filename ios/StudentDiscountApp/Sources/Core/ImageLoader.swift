import SwiftUI
import UIKit
import CryptoKit

/// Загрузка картинок с сервера: уменьшенная копия под размер на экране (?w=),
/// кэш в памяти и на диске. Раньше AsyncImage каждый раз тянул оригиналы по 1–5 МБ,
/// и список друзей «прогружался» секунды.
actor ImageLoader {
    static let shared = ImageLoader()

    /// NSCache потокобезопасен; статический, чтобы читать его синхронно при отрисовке.
    private static let memory: NSCache<NSURL, UIImage> = {
        let c = NSCache<NSURL, UIImage>()
        c.totalCostLimit = 60 * 1024 * 1024
        return c
    }()
    private var inflight: [URL: Task<UIImage?, Never>] = [:]
    private let dir: URL = {
        let d = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("images", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()
    private let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.urlCache = nil // свой кэш на диске
        c.timeoutIntervalForRequest = 30
        c.httpMaximumConnectionsPerHost = 6
        return URLSession(configuration: c)
    }()

    /// Размеры, которые умеет отдавать сервер (короткая сторона в пикселях).
    static let widths = [64, 128, 256, 512, 1024]

    /// URL уменьшенной копии для стороны `points` (в точках экрана).
    nonisolated static func url(_ path: String?, points: CGFloat) -> URL? {
        guard let base = AppConfig.mediaURL(path) else { return nil }
        // Чужие адреса (http…) и не наши картинки не трогаем.
        guard base.path.hasPrefix("/uploads/"), var c = URLComponents(url: base, resolvingAgainstBaseURL: false) else { return base }
        let px = Int(points * 3)
        let w = widths.first { $0 >= px } ?? widths.last!
        c.queryItems = (c.queryItems ?? []) + [URLQueryItem(name: "w", value: String(w))]
        return c.url ?? base
    }

    nonisolated func cached(_ url: URL) -> UIImage? {
        Self.memory.object(forKey: url as NSURL)
    }

    func image(_ url: URL) async -> UIImage? {
        if let m = Self.memory.object(forKey: url as NSURL) { return m }
        if let t = inflight[url] { return await t.value }
        let file = dir.appendingPathComponent(Self.key(url))
        let t = Task<UIImage?, Never> { [session] in
            if let d = try? Data(contentsOf: file), let img = UIImage(data: d) {
                return img.preparingForDisplay() ?? img
            }
            guard let (d, r) = try? await session.data(from: url),
                  (r as? HTTPURLResponse)?.statusCode == 200,
                  let img = UIImage(data: d) else { return nil }
            try? d.write(to: file, options: .atomic)
            return img.preparingForDisplay() ?? img
        }
        inflight[url] = t
        let img = await t.value
        inflight[url] = nil
        if let img {
            Self.memory.setObject(img, forKey: url as NSURL, cost: Int(img.size.width * img.size.height * img.scale * img.scale * 4))
        }
        return img
    }

    private static func key(_ url: URL) -> String {
        SHA256.hash(data: Data(url.absoluteString.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

/// Картинка с сервера. Из кэша памяти показывается сразу, без мигания.
struct RemoteImage: View {
    let url: URL?
    @State private var image: UIImage?

    init(_ url: URL?) {
        self.url = url
        _image = State(initialValue: url.flatMap { ImageLoader.shared.cached($0) })
    }

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
                    // scaledToFill вылезает за рамку, а .clipped() обрезает только картинку, не касания:
                    // невидимая часть вертикальной обложки перехватывала нажатия на кнопку «назад» над ней.
                    .allowsHitTesting(false)
                    .transition(.opacity)
            } else {
                Color.clear
            }
        }
        .task(id: url) {
            guard let url else { image = nil; return }
            if image != nil, ImageLoader.shared.cached(url) === image { return }
            let img = await ImageLoader.shared.image(url)
            withAnimation(.easeOut(duration: 0.15)) { image = img }
        }
    }
}
