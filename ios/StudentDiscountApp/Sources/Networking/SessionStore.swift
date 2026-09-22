import Foundation

/// Источник истины для состояния авторизации. Держит текущего пользователя,
/// прокидывает токен в APIClient и переживает перезапуск приложения за счёт
/// Keychain.
@MainActor
final class SessionStore: ObservableObject {
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?

    var isAuthenticated: Bool { currentUser != nil }

    init() {
        if let token = KeychainService.loadToken() {
            APIClient.shared.accessToken = token
            Task { await self.refreshProfile() }
        }
    }

    func login(email: String, password: String) async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }
        do {
            let response: AuthResponse = try await APIClient.shared.post(
                "/api/v1/auth/login",
                body: LoginRequest(email: email, password: password)
            )
            guard let token = response.resolvedAccessToken else {
                errorMessage = "Сервер не вернул токен доступа"
                return
            }
            persist(token: token)
            await refreshProfile()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func register(email: String, password: String, fullName: String, referralCode: String?) async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }
        do {
            let response: AuthResponse = try await APIClient.shared.post(
                "/api/v1/auth/register",
                body: RegisterRequest(
                    email: email,
                    password: password,
                    fullName: fullName,
                    referralCode: (referralCode?.isEmpty ?? true) ? nil : referralCode
                )
            )
            guard let token = response.resolvedAccessToken else {
                errorMessage = "Сервер не вернул токен доступа"
                return
            }
            persist(token: token)
            if let user = response.user {
                currentUser = user
            } else {
                await refreshProfile()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func logout() {
        KeychainService.deleteToken()
        APIClient.shared.accessToken = nil
        currentUser = nil
    }

    func refreshProfile() async {
        do {
            let user: User = try await APIClient.shared.get("/api/v1/users/me")
            currentUser = user
        } catch APIError.unauthorized {
            logout()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func persist(token: String) {
        KeychainService.saveToken(token)
        APIClient.shared.accessToken = token
    }
}
