import SwiftUI

/// Основная CTA-кнопка — лаймовый акцент, используется точечно
/// (одна главная кнопка на экране, не на каждом элементе списка).
struct PrimaryButtonStyle: ButtonStyle {
    var isLoading: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.Typography.headline)
            .foregroundStyle(Color.black)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(Theme.Colors.accent.opacity(configuration.isPressed ? 0.8 : 1))
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous))
            .opacity(isLoading ? 0.6 : 1)
    }
}

/// Второстепенная кнопка — тонкая обводка, без заливки. Для действий вроде
/// «Мне интересно», «Отмена».
struct GhostButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.Typography.headline)
            .foregroundStyle(Theme.Colors.textPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(Theme.Colors.surfaceSecondary.opacity(configuration.isPressed ? 0.6 : 1))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous)
                    .strokeBorder(Theme.Colors.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous))
    }
}

extension ButtonStyle where Self == PrimaryButtonStyle {
    static var routePrimary: PrimaryButtonStyle { PrimaryButtonStyle() }
}

extension ButtonStyle where Self == GhostButtonStyle {
    static var routeGhost: GhostButtonStyle { GhostButtonStyle() }
}
