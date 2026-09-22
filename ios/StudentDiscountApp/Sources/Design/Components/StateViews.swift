import SwiftUI

/// Лоадер на основе маршрутного мотива вместо стандартного спиннера.
struct RouteLoadingView: View {
    var body: some View {
        VStack(spacing: Theme.Spacing.l) {
            RouteMark(animated: true)
            RouteLoadingIndicator()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Colors.background)
    }
}

/// Пустое состояние — тихое, без иллюстраций «на всю плашку», с пунктиром.
struct RouteEmptyState: View {
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(spacing: Theme.Spacing.m) {
            DottedDivider()
                .frame(width: 90)
            Text(title)
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            if let subtitle {
                Text(subtitle)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            DottedDivider()
                .frame(width: 90)
        }
        .padding(.horizontal, Theme.Spacing.xxxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Colors.background)
    }
}

/// Состояние ошибки — тот же тихий язык, с возможностью повторить.
struct RouteErrorState: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: Theme.Spacing.m) {
            Text("Что-то пошло не так")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text(message)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
            Button("Повторить", action: retry)
                .buttonStyle(.routeGhost)
                .padding(.top, Theme.Spacing.s)
                .frame(width: 160)
        }
        .padding(.horizontal, Theme.Spacing.xxxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Colors.background)
    }
}
