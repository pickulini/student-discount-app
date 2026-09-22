import SwiftUI

private struct OnboardingPage {
    let title: String
    let subtitle: String
}

private let onboardingPages: [OnboardingPage] = [
    .init(title: "Скидки рядом", subtitle: "Находи выгодные предложения там, где ты сейчас"),
    .init(title: "Места", subtitle: "Кафе, спорт, развлечения — новые точки на карте города"),
    .init(title: "События", subtitle: "Концерты, встречи, активности — что происходит вокруг"),
    .init(title: "Люди", subtitle: "Находи друзей и делись находками"),
    .init(title: "Город", subtitle: "Открывай его шаг за шагом"),
]

/// Онбординг использует ту же метафору маршрута: пользователь проходит
/// путь по точкам-страницам. Без сложных иллюстраций.
struct OnboardingView: View {
    let onFinish: () -> Void
    @State private var page = 0

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            TabView(selection: $page) {
                ForEach(Array(onboardingPages.enumerated()), id: \.offset) { index, item in
                    VStack(spacing: Theme.Spacing.l) {
                        Text(item.title)
                            .font(Theme.Typography.largeTitle)
                            .foregroundStyle(Theme.Colors.textPrimary)
                        Text(item.subtitle)
                            .font(Theme.Typography.body)
                            .foregroundStyle(Theme.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, Theme.Spacing.xxxl)
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            journeyIndicator

            Spacer()

            Button(page == onboardingPages.count - 1 ? "Начать" : "Далее") {
                if page == onboardingPages.count - 1 {
                    onFinish()
                } else {
                    withAnimation { page += 1 }
                }
            }
            .buttonStyle(.routePrimary)
            .padding(.horizontal, Theme.Spacing.xxl)

            Button("Пропустить", action: onFinish)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
                .padding(.top, Theme.Spacing.l)
                .padding(.bottom, Theme.Spacing.xl)
        }
        .background(Theme.Colors.background.ignoresSafeArea())
    }

    /// ● · · · ● · · · ● — пройденные точки маршрута окрашены акцентом.
    private var journeyIndicator: some View {
        HStack(spacing: 10) {
            ForEach(0..<onboardingPages.count, id: \.self) { index in
                Circle()
                    .fill(index <= page ? Theme.Colors.accent : Theme.Colors.divider)
                    .frame(width: index == page ? 7 : 5, height: index == page ? 7 : 5)
                    .animation(.easeInOut(duration: 0.2), value: page)
            }
        }
        .padding(.top, Theme.Spacing.l)
    }
}
