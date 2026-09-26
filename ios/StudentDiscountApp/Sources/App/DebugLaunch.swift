import Foundation

#if DEBUG
/// Только для отладки на симуляторе: вход и открытие экрана по аргументам запуска.
///   -uitest_email x -uitest_password y  — войти
///   -uitest_tab wallet                   — открыть вкладку
///   -uitest_route offer:1                — открыть экран
enum DebugLaunch {
    static var email: String? { UserDefaults.standard.string(forKey: "uitest_email") }
    static var password: String? { UserDefaults.standard.string(forKey: "uitest_password") }
    static var tab: AppTab? { UserDefaults.standard.string(forKey: "uitest_tab").flatMap(AppTab.init(rawValue:)) }

    static var route: Route? {
        guard let s = UserDefaults.standard.string(forKey: "uitest_route") else { return nil }
        let parts = s.split(separator: ":", maxSplits: 1).map(String.init)
        let arg = parts.count > 1 ? parts[1] : ""
        let id = Int64(arg) ?? 0
        switch parts[0] {
        case "offer": return .offer(id)
        case "checkout": return .checkout(id, sbp: false)
        case "order": return .order(id)
        case "orders": return .orders
        case "savings": return .savings
        case "event": return .event(id)
        case "eventNew": return .eventNew
        case "eventStats": return .eventStats(id)
        case "referral": return .referral
        case "friends": return .friends
        case "subscriptions": return .subscriptions
        case "notifications": return .notifications
        case "support": return .support(topic: arg.isEmpty ? nil : arg)
        case "supportChat": return .supportChat(id)
        case "settings": return .settings
        case "settingsProfile": return .settingsProfile
        case "settingsPrivacy": return .settingsPrivacy
        case "settingsNotifications": return .settingsNotifications
        case "settingsSecurity": return .settingsSecurity
        case "settingsAccount": return .settingsAccount
        case "verification": return .verification(afterRegister: false)
        case "user": return .user(arg)
        default: return nil
        }
    }

    @MainActor
    static func apply(_ session: Session) async {
        if let e = email, let p = password, session.phase != .signedIn || session.user.email.string != e {
            if let r = try? await API.shared.request("POST", "auth/login", body: .json(["email": e, "password": p]), auth: false) {
                try? await session.signIn(access: r.access_token.str, refresh: r.refresh_token.string)
            }
        }
        if let t = tab { session.tab = t }
        if let r = route { session.push(r) }
    }
}
#endif
