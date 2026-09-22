import Foundation

struct User: Codable, Identifiable, Equatable {
    let id: Int64
    let email: String
    let fullName: String
    let nickname: String?
    let username: String?
    let avatarURL: String?
    let universityName: String?
    let course: Int?
    let studentStatus: String
    let referralCode: String
    let balance: Double
    let role: String
    let isVIP: Bool

    enum CodingKeys: String, CodingKey {
        case id, email, nickname, username, course, balance, role
        case fullName = "full_name"
        case avatarURL = "avatar_url"
        case universityName = "university_name"
        case studentStatus = "student_status"
        case referralCode = "referral_code"
        case isVIP = "is_vip"
    }
}
