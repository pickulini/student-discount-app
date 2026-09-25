import SwiftUI

@main
struct StudentDiscountApp: App {
    @StateObject private var session = Session()
    @AppStorage("theme") private var theme: String = ThemePref.auto.rawValue

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .themedRoot()
                .preferredColorScheme(ThemePref(rawValue: theme)?.scheme)
                .task {
                    await session.bootstrap()
                    #if DEBUG
                    await DebugLaunch.apply(session)
                    #endif
                }
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var session: Session
    @Environment(\.palette) private var p

    var body: some View {
        Group {
            switch session.phase {
            case .loading:
                SplashView()
            case .signedOut:
                AuthFlow()
            case .signedIn:
                MainTabs()
            }
        }
        .animation(.easeOut(duration: 0.2), value: session.phase)
    }
}

struct SplashView: View {
    @Environment(\.palette) private var p
    var body: some View {
        VStack(spacing: 18) {
            Text("СТУДЕНТ−%").font(AppFont.display(32)).em(-0.02, 32).foregroundColor(p.ink)
            Barcode(seed: 2026, height: 26).frame(width: 176)
            LoadingView().frame(height: 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(p.bg.ignoresSafeArea())
    }
}

/// Четыре вкладки, у каждой свой стек экранов. Нижнее меню — только на корневых экранах,
/// как на мобильном сайте; внутри — строка «← назад».
struct MainTabs: View {
    @EnvironmentObject private var session: Session
    @Environment(\.palette) private var p

    var body: some View {
        let atRoot = (session.paths[session.tab]?.count ?? 0) == 0
        ZStack {
            ForEach(AppTab.allCases, id: \.self) { t in
                NavigationStack(path: session.path(t)) {
                    root(t)
                        .navigationDestination(for: Route.self) { $0.view }
                }
                .opacity(session.tab == t ? 1 : 0)
                .allowsHitTesting(session.tab == t)
                .accessibilityHidden(session.tab != t)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if atRoot { BottomBar().transition(.move(edge: .bottom).combined(with: .opacity)) }
        }
        .animation(.easeOut(duration: 0.18), value: atRoot)
    }

    @ViewBuilder
    private func root(_ t: AppTab) -> some View {
        switch t {
        case .home: HomeView()
        case .events: EventsView()
        case .wallet: WalletView()
        case .profile: ProfileView()
        }
    }
}
