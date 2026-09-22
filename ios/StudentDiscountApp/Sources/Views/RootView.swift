import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var showSplash = true
    @AppStorage("has_seen_onboarding") private var hasSeenOnboarding = false

    var body: some View {
        Group {
            if showSplash {
                SplashView()
                    .task {
                        try? await Task.sleep(nanoseconds: 700_000_000)
                        showSplash = false
                    }
            } else if !hasSeenOnboarding {
                OnboardingView { hasSeenOnboarding = true }
            } else if session.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: showSplash)
        .animation(.easeInOut(duration: 0.25), value: hasSeenOnboarding)
        .animation(.default, value: session.isAuthenticated)
        .themed()
    }
}

private struct MainTabView: View {
    init() {
        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundColor = UIColor(Theme.Colors.background).withAlphaComponent(0.85)
        appearance.backgroundEffect = UIBlurEffect(style: .systemChromeMaterialDark)
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
        UITabBar.appearance().tintColor = UIColor(Theme.Colors.accent)
        UITabBar.appearance().unselectedItemTintColor = UIColor(Theme.Colors.textMuted)

        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithOpaqueBackground()
        navAppearance.backgroundColor = UIColor(Theme.Colors.background)
        navAppearance.titleTextAttributes = [.foregroundColor: UIColor(Theme.Colors.textPrimary)]
        navAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor(Theme.Colors.textPrimary)]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
        UINavigationBar.appearance().compactAppearance = navAppearance
    }

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Главная", systemImage: "square.grid.2x2") }

            EventsListView()
                .tabItem { Label("События", systemImage: "calendar") }

            DiscountsListView()
                .tabItem { Label("Скидки", systemImage: "sparkles") }

            ProfileView()
                .tabItem { Label("Профиль", systemImage: "person.crop.circle") }
        }
    }
}
