import Foundation

/// Названо AppNotification, чтобы не конфликтовать с Foundation.Notification.
struct AppNotification: Codable, Identifiable {
    let id: Int64
    let type: String
    let title: String
    let body: String?
    let actorName: String?
    let actorAvatar: String?
    let readAt: Date?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, type, title, body
        case actorName = "actor_name"
        case actorAvatar = "actor_avatar"
        case readAt = "read_at"
        case createdAt = "created_at"
    }

    var isUnread: Bool { readAt == nil }
}
