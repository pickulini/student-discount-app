import SwiftUI
import UIKit

/// Все внутренние экраны. Каждая вкладка — свой NavigationStack с этими маршрутами.
enum Route: Hashable {
    case offer(Int64)
    case checkout(Int64, sbp: Bool)
    case order(Int64)
    case orders
    case savings
    case event(Int64)
    case eventNew
    case eventStats(Int64)
    case referral
    case friends
    case subscriptions
    case notifications
    case support(topic: String?)
    case supportChat(Int64)
    case settings
    case settingsProfile
    case settingsPrivacy
    case settingsNotifications
    case settingsSecurity
    case settingsAccount
    case verification(afterRegister: Bool)
    case user(String)
}

extension Route {
    @MainActor @ViewBuilder
    var view: some View {
        switch self {
        case let .offer(id): OfferDetailView(id: id)
        case let .checkout(id, sbp): CheckoutView(offerID: id, startWithSBP: sbp)
        case let .order(id): ReceiptView(orderID: id)
        case .orders: OrdersView()
        case .savings: SavingsView()
        case let .event(id): EventDetailView(id: id)
        case .eventNew: EventFormView()
        case let .eventStats(id): EventStatsView(id: id)
        case .referral: ReferralView()
        case .friends: FriendsView()
        case .subscriptions: SubscriptionsView()
        case .notifications: NotificationsView()
        case let .support(topic): SupportView(topic: topic)
        case let .supportChat(id): SupportChatView(ticketID: id)
        case .settings: SettingsView()
        case .settingsProfile: SettingsProfileView()
        case .settingsPrivacy: SettingsPrivacyView()
        case .settingsNotifications: SettingsNotificationsView()
        case .settingsSecurity: SettingsSecurityView()
        case .settingsAccount: SettingsAccountView()
        case let .verification(after): VerificationView(afterRegister: after)
        case let .user(handle): PublicProfileView(username: handle)
        }
    }
}

/// Системную навигационную панель прячем (шапки свои, как в макете), но жест
/// «смахнуть назад» от края экрана оставляем — без этого он пропадает.
extension UINavigationController: @retroactive UIGestureRecognizerDelegate {
    override open func viewDidLoad() {
        super.viewDidLoad()
        interactivePopGestureRecognizer?.delegate = self
    }

    public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        viewControllers.count > 1
    }
}
