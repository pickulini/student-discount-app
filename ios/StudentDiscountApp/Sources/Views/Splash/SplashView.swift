import SwiftUI

/// Минималистичный тёмный splash: лого-метафора маршрута, тихо оживающая.
/// Concept: ● · · · · · · · ●
struct SplashView: View {
    var body: some View {
        VStack(spacing: Theme.Spacing.xxl) {
            RouteMark(dotCount: 7, pointDiameter: 10, animated: true)
            VStack(spacing: 4) {
                Text("STUDENT DISCOUNT")
                    .font(Theme.Typography.label)
                    .tracking(2)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Colors.background)
    }
}
