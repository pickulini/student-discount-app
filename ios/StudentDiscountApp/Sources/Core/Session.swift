import SwiftUI

/// Состояние приложения: кто вошёл, счётчик уведомлений, выбранная вкладка.
@MainActor
final class Session: ObservableObject {
    enum Phase { case loading, signedOut, signedIn }

    @Published var phase: Phase = .loading
    @Published var user: JSON = .null
    @Published var unread = 0
    @Published var tab: AppTab = .home
    /// Переход «наверх» по повторному тапу вкладки: у каждой вкладки свой стек.
    @Published var paths: [AppTab: NavigationPath] = [:]

    private var pollTask: Task<Void, Never>?

    init() {
        API.onSessionExpired = { [weak self] in
            self?.signOutLocally()
        }
    }

    var isVerified: Bool { user.student_status.str == "verified" }
    var firstName: String {
        let n = user.nickname.string ?? user.full_name.str.split(separator: " ").first.map(String.init) ?? ""
        return n
    }
    var uniShort: String { user.university_short.str }

    func bootstrap() async {
        guard API.accessToken != nil else { phase = .signedOut; return }
        do {
            user = try await API.shared.get("users/me")
            phase = .signedIn
            startPolling()
        } catch APIError.unauthorized {
            phase = .signedOut
        } catch {
            // Нет сети — всё равно пускаем внутрь с сохранёнными токенами; экраны покажут ошибку.
            phase = .signedIn
            startPolling()
        }
    }

    func refreshUser() async {
        if let u = try? await API.shared.get("users/me") { user = u }
    }

    func signIn(access: String, refresh: String?) async throws {
        API.accessToken = access
        if let refresh, !refresh.isEmpty { API.refreshToken = refresh }
        user = try await API.shared.get("users/me")
        tab = .home
        paths = [:]
        phase = .signedIn
        startPolling()
    }

    func signOut() {
        signOutLocally()
    }

    private func signOutLocally() {
        API.clearTokens()
        pollTask?.cancel()
        user = .null
        unread = 0
        paths = [:]
        phase = .signedOut
    }

    // MARK: уведомления

    func refreshUnread() async {
        if let r = try? await API.shared.get("notifications/unread/count") { unread = r.count.int ?? 0 }
    }

    private func startPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refreshUnread()
                try? await Task.sleep(nanoseconds: 30_000_000_000)
            }
        }
    }

    // MARK: навигация

    func path(_ tab: AppTab) -> Binding<NavigationPath> {
        Binding(get: { self.paths[tab] ?? NavigationPath() }, set: { self.paths[tab] = $0 })
    }

    func push(_ route: Route) {
        var p = paths[tab] ?? NavigationPath()
        p.append(route)
        paths[tab] = p
    }

    func popToRoot() { paths[tab] = NavigationPath() }

    func open(_ tab: AppTab, _ route: Route? = nil) {
        self.tab = tab
        var p = NavigationPath()
        if let route { p.append(route) }
        paths[tab] = p
    }
}

enum AppTab: String, CaseIterable {
    case home, events, wallet, profile

    var label: String {
        switch self {
        case .home: return "Главная"
        case .events: return "Ивенты"
        case .wallet: return "Кошелёк"
        case .profile: return "Профиль"
        }
    }
}
