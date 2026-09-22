import Foundation

struct UserPublicCard: Codable, Identifiable {
    let id: Int64
    let friendshipID: Int64?
    let nickname: String?
    let username: String?
    let fullName: String
    let avatarURL: String?
    let university: String?

    enum CodingKeys: String, CodingKey {
        case id, nickname, username, university
        case friendshipID = "friendship_id"
        case fullName = "full_name"
        case avatarURL = "avatar_url"
    }

    var displayName: String {
        nickname ?? fullName
    }
}

struct Friendship: Codable, Identifiable {
    let id: Int64
    let requesterID: Int64
    let addresseeID: Int64
    let status: String

    enum CodingKeys: String, CodingKey {
        case id, status
        case requesterID = "requester_id"
        case addresseeID = "addressee_id"
    }
}
