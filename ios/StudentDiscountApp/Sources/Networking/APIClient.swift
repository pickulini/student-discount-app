import Foundation

/// Единая точка входа для всех запросов к Go-бэкенду. Работает поверх
/// async/await URLSession, сама подставляет Bearer-токен и приводит ошибки
/// сервера к читаемому виду.
final class APIClient {
    static let shared = APIClient()

    var accessToken: String?

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        session = URLSession(configuration: config)

        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
    }

    // MARK: - Публичные методы

    func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        try await send(path: path, method: "GET", query: query, body: Optional<EmptyBody>.none)
    }

    func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        try await send(path: path, method: "POST", query: [:], body: body)
    }

    func post<T: Decodable>(_ path: String) async throws -> T {
        try await send(path: path, method: "POST", query: [:], body: Optional<EmptyBody>.none)
    }

    func patch<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        try await send(path: path, method: "PATCH", query: [:], body: body)
    }

    // MARK: - Реализация

    private struct EmptyBody: Encodable {}

    private func send<T: Decodable, B: Encodable>(
        path: String,
        method: String,
        query: [String: String],
        body: B?
    ) async throws -> T {
        guard var components = URLComponents(
            url: AppConfig.baseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidURL
        }
        if !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components.url else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        if let body, !(body is EmptyBody) {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.network(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.network(URLError(.badServerResponse))
        }

        switch httpResponse.statusCode {
        case 200..<300:
            if T.self == EmptyResponse.self {
                return EmptyResponse() as! T
            }
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decoding(error)
            }
        case 401:
            throw APIError.unauthorized
        default:
            let message = (try? decoder.decode(ServerErrorBody.self, from: data))?.resolvedMessage ?? ""
            throw APIError.server(status: httpResponse.statusCode, message: message)
        }
    }
}

/// Используется, когда ответ сервера нас не интересует (например,
/// "message": "ok"), но тип результата всё равно нужен дженерику.
struct EmptyResponse: Decodable {}

private struct ServerErrorBody: Decodable {
    let message: String?
    let error: String?

    var resolvedMessage: String? { message ?? error }
}
