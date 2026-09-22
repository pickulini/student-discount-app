import Foundation

struct RegisterRequest: Encodable {
    let email: String
    let password: String
    let fullName: String
    let referralCode: String?

    enum CodingKeys: String, CodingKey {
        case email, password
        case fullName = "full_name"
        case referralCode = "referral_code"
    }
}

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

/// Бэкенд возвращает разную форму ответа для /register (user + token) и
/// /login (access_token + refresh_token), поэтому все поля опциональны и
/// SessionStore сам решает, что использовать.
struct AuthResponse: Decodable {
    let user: User?
    let token: String?
    let accessToken: String?
    let refreshToken: String?

    enum CodingKeys: String, CodingKey {
        case user, token
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
    }

    var resolvedAccessToken: String? {
        accessToken ?? token
    }
}
