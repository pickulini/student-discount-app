import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case unauthorized
    case server(status: Int, message: String)
    case decoding(Error)
    case network(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Некорректный адрес сервера"
        case .unauthorized:
            return "Сессия истекла, войдите заново"
        case .server(let status, let message):
            return message.isEmpty ? "Ошибка сервера (\(status))" : message
        case .decoding:
            return "Не удалось разобрать ответ сервера"
        case .network(let error):
            return "Ошибка сети: \(error.localizedDescription)"
        }
    }
}
