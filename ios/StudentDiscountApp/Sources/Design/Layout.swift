import SwiftUI

// MARK: - Шапки

/// Шапка вкладки: логотип слева, справа — колокольчик и вуз (или своё действие).
struct TabHeader<Right: View>: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    let right: Right

    init(@ViewBuilder right: () -> Right) { self.right = right() }

    var body: some View {
        HStack(spacing: 16) {
            Text("СТУДЕНТ−%").font(AppFont.display(18)).em(-0.02, 18).foregroundColor(p.ink)
            Spacer()
            Bell()
            right
        }
        .frame(minHeight: 22)
    }
}

extension TabHeader where Right == UniBadge {
    init() { self.right = UniBadge() }
}

/// «МГУ ✓» — вуз и статус; ведёт в профиль.
struct UniBadge: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    var body: some View {
        Button { session.open(.profile) } label: {
            Text((session.uniShort.isEmpty ? session.firstName : session.uniShort).uppercased() + (session.isVerified ? " ✓" : ""))
                .font(AppFont.mono(11, .medium)).em(0.06, 11).foregroundColor(p.ink)
        }
        .buttonStyle(.plain)
    }
}

/// Колокольчик с красным счётчиком новых уведомлений — всегда на виду.
struct Bell: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    var body: some View {
        Button { session.push(.notifications) } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "bell").font(.system(size: 17, weight: .regular)).foregroundColor(p.ink)
                    .frame(width: 28, height: 28)
                if session.unread > 0 {
                    Text(session.unread > 99 ? "99+" : "\(session.unread)")
                        .font(AppFont.mono(10, .bold)).foregroundColor(p.accentInk)
                        .padding(.horizontal, 3).frame(minWidth: 16, minHeight: 16)
                        .background(p.accent)
                        .offset(x: 6, y: -2)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(session.unread > 0 ? "Уведомления: \(session.unread) новых" : "Уведомления")
    }
}

/// «← НАЗАД ......... [ ДЕЙСТВИЕ ]» — шапка внутренних экранов.
struct BackHeader<Right: View>: View {
    @Environment(\.palette) private var p
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var session: Session
    var label = "Назад"
    var mark = "←"
    var action: (() -> Void)? = nil
    let right: Right

    init(_ label: String = "Назад", mark: String = "←", action: (() -> Void)? = nil, @ViewBuilder right: () -> Right) {
        self.label = label
        self.mark = mark
        self.action = action
        self.right = right()
    }

    var body: some View {
        HStack {
            Button(action: goBack) {
                // Зона нажатия ~44×44 pt: раньше нажимался только сам текст высотой 22 pt.
                Text("\(mark) \(label.uppercased())").font(AppFont.mono(11, .medium)).em(0.06, 11).foregroundColor(p.ink)
                    .padding(.vertical, 12).padding(.trailing, 24)
                    .frame(minWidth: 44, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Spacer()
            right
        }
        .frame(minHeight: 22)
        .padding(.vertical, -12)
    }

    /// Назад — явно по стеку вкладки. Системный dismiss() в стеках, которыми управляет
    /// Session, иногда молча ничего не делал; он остаётся запасным вариантом (вход/регистрация).
    private func goBack() {
        if let action { action(); return }
        if session.phase == .signedIn, session.pop() { return }
        dismiss()
    }
}

extension BackHeader where Right == EmptyView {
    init(_ label: String = "Назад", mark: String = "←", action: (() -> Void)? = nil) {
        self.init(label, mark: mark, action: action) { EmptyView() }
    }
}

/// Моно-метка справа в шапке: «ШАГ 2 ИЗ 2», «НОВЫЙ ЗАКАЗ».
struct HeaderMeta: View {
    @Environment(\.palette) private var p
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text.uppercased()).font(AppFont.mono(11, .medium)).em(0.06, 11).foregroundColor(p.ink)
    }
}

// MARK: - Экран

/// Прокручиваемый экран в стиле чека: отступ 20, шапка сверху, линия отрыва внизу.
struct Screen<Header: View, Content: View>: View {
    @Environment(\.palette) private var p
    let spacing: CGFloat
    let header: Header
    let content: Content
    var onRefresh: (() async -> Void)? = nil

    init(spacing: CGFloat = 20, onRefresh: (() async -> Void)? = nil, @ViewBuilder header: () -> Header, @ViewBuilder content: () -> Content) {
        self.spacing = spacing
        self.header = header()
        self.content = content()
        self.onRefresh = onRefresh
    }

    var body: some View {
        let scroll = ScrollView {
            VStack(alignment: .leading, spacing: spacing) {
                header
                content
                TearEdge().padding(.top, 12)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(p.bg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)

        if let onRefresh {
            scroll.refreshable { await onRefresh() }
        } else {
            scroll
        }
    }
}

/// Экран-заглушка на время загрузки: шапка сверху и индикатор по центру.
struct LoadingScreen<Header: View>: View {
    @Environment(\.palette) private var p
    let header: Header
    var label: String? = nil
    init(_ label: String? = nil, @ViewBuilder header: () -> Header) {
        self.label = label
        self.header = header()
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header.padding(.horizontal, 20).padding(.top, 20)
            LoadingView(label: label)
        }
        .background(p.bg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
    }
}

// MARK: - Нижнее меню

struct BottomBar: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session

    var body: some View {
        VStack(spacing: 0) {
            DashLine().stroke(p.ink, style: StrokeStyle(lineWidth: 1, dash: [3, 3])).frame(height: 1)
            HStack {
                ForEach(AppTab.allCases, id: \.self) { t in
                    Button {
                        if session.tab == t { session.popToRoot() } else { session.tab = t }
                    } label: {
                        Text(t.label.uppercased())
                            .font(AppFont.mono(11, session.tab == t ? .bold : .regular)).em(0.04, 11)
                            .foregroundColor(session.tab == t ? p.ink : p.inkSoft)
                            .frame(maxWidth: .infinity, alignment: t == .home ? .leading : t == .profile ? .trailing : .center)
                            .padding(.vertical, 14)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
        }
        .background(p.bg.ignoresSafeArea(edges: .bottom))
    }
}
