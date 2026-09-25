import SwiftUI

/// Профиль (макет 50): аватар, статус, статистика, разделы, публичный профиль и выход.
struct ProfileView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session

    @State private var orders: [JSON] = []
    @State private var friends: [JSON] = []
    @State private var incoming: [JSON] = []
    @State private var subs: [JSON] = []
    @State private var confirmLogout = false

    var body: some View {
        let u = session.user
        let name = u.nickname.string ?? u.full_name.str
        let active = orders.filter { ["created", "paid"].contains($0.status.str) }
        let saved = orders.filter(OrderMath.spent).reduce(0) { $0 + $1.discount_amount.num }
        let verified = u.student_status.str == "verified"

        Screen(spacing: 20, onRefresh: load) {
            TabHeader {
                Button("Настройки") { session.push(.settings) }.buttonStyle(.bracket(11))
            }
        } content: {
            HStack(spacing: 20) {
                Avatar(url: u.avatar_url.string, name: name, size: 88)
                VStack(alignment: .leading, spacing: 6) {
                    Text(name).font(AppFont.display(22)).em(-0.01, 22).foregroundColor(p.ink).fixedSize(horizontal: false, vertical: true)
                    if let un = u.username.string, !un.isEmpty { Text("@" + un).font(AppFont.text(13)).foregroundColor(p.inkSoft) }
                    let line = [u.university_short.string, u.course.int.map { "\($0) курс" }].compactMap { $0 }.joined(separator: " · ")
                    if !line.isEmpty { Text(line).font(AppFont.text(13)).foregroundColor(p.inkSoft) }
                }
            }
            if verified {
                Leader(label: "Статус студента", value: u.student_verification_expires_at.date.map { "✓ ДО \(Fmt.ddmmyy($0))" } ?? "✓ ПОДТВЕРЖДЁН", valueBold: true)
            } else {
                Button { session.push(.verification(afterRegister: false)) } label: {
                    Leader(label: "Статус студента", value: "ПОДТВЕРДИТЬ →", valueColor: p.accent, valueBold: true)
                }
                .buttonStyle(.plain)
            }
            HStack(alignment: .top, spacing: 16) {
                StatCell(value: "\(friends.count)", label: "Друзей")
                    .onTapGesture { session.push(.friends) }
                VRule().frame(height: 44)
                StatCell(value: "\(subs.count)", label: "Подписок")
                    .onTapGesture { session.push(.subscriptions) }
                VRule().frame(height: 44)
                StatCell(value: Fmt.rub(saved), label: "Сэкономлено", accent: true)
                    .onTapGesture { session.push(.savings) }
            }
            Rule2()
            VStack(spacing: 0) {
                row(.orders, "Заказы", active.isEmpty ? "Активных чеков нет" : "\(active.count) \(Fmt.plural(active.count, "активный чек", "активных чека", "активных чеков"))")
                Rule()
                row(.savings, "Журнал экономии")
                Rule()
                row(.friends, "Друзья", incoming.isEmpty ? nil : "\(incoming.count) \(Fmt.plural(incoming.count, "новая заявка", "новые заявки", "новых заявок"))",
                    badge: incoming.isEmpty ? nil : "\(incoming.count)")
                Rule()
                row(.subscriptions, "Подписки", "Компании, за которыми вы следите")
                Rule()
                row(.notifications, "Уведомления", badge: session.unread > 0 ? "\(session.unread)" : nil)
                Rule()
                row(.referral, "Рефералы", "+100 бонусов за друга")
                Rule()
                row(.support(topic: nil), "Поддержка")
            }
            .padding(.vertical, -4)
            Rule2()
            HStack {
                if let un = u.username.string, !un.isEmpty {
                    Button("Мой публичный профиль") { session.push(.user(un)) }.buttonStyle(.bracket)
                }
                Spacer()
                Button("Выйти") { confirmLogout = true }.buttonStyle(.bracket)
            }
        }
        .task { await load() }
        .confirmationDialog("Выйти из аккаунта?", isPresented: $confirmLogout, titleVisibility: .visible) {
            Button("Выйти", role: .destructive) { session.signOut() }
            Button("Отмена", role: .cancel) {}
        }
    }

    private func row(_ r: Route, _ title: String, _ sub: String? = nil, badge: String? = nil) -> some View {
        Button { session.push(r) } label: { NavRow(title: title, sub: sub, badge: badge) }.buttonStyle(.plain)
    }

    private func load() async {
        async let o = try? API.shared.get("orders")
        async let f = try? API.shared.get("friends")
        async let i = try? API.shared.get("friends/requests/incoming")
        async let s = try? API.shared.get("subscriptions/companies")
        orders = (await o)?.array ?? []
        friends = (await f)?.array ?? []
        incoming = (await i)?.array ?? []
        subs = (await s)?.array ?? []
        await session.refreshUser()
        await session.refreshUnread()
    }
}

/// Публичный профиль (макет 51).
struct PublicProfileView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    let username: String

    @State private var profile: JSON?
    @State private var extras: JSON = .null
    @State private var events: [JSON] = []
    @State private var status: JSON = .null
    @State private var notFound = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        if notFound {
            Screen { BackHeader() } content: { EmptyState(title: "Пользователь не найден") }
        } else if let profile {
            content(profile)
        } else {
            LoadingScreen("Загружаем профиль…") { BackHeader() }.task { await load() }
        }
    }

    @ViewBuilder
    private func content(_ pr: JSON) -> some View {
        let name = pr.nickname.string ?? pr.full_name.str
        let first = name.split(separator: " ").first.map(String.init) ?? name
        let isSelf = pr["id"].int64 == session.user["id"].int64
        let st = status.status.string ?? "none"
        let handle = ["@" + (pr.username.string ?? username), extras.university.string].compactMap { $0 }.joined(separator: " · ")
        let upcoming = events.map { ($0, EventsCore.next($0)) }.filter { $0.1.end >= Date() }.sorted { $0.1.start < $1.1.start }.prefix(5)
        let subsNames = extras.subscriptions.array.map { $0.name.str }

        Screen(spacing: 20, onRefresh: load) {
            BackHeader {
                if !isSelf && (st == "friends" || st == "pending_outgoing" || st == "pending_incoming") {
                    Menu {
                        if st == "friends" { Button("Удалить из друзей", role: .destructive) { act { try await API.shared.delete("friends/\(pr["id"].id)") } } }
                        if st == "pending_outgoing" { Button("Отменить заявку") { act { try await API.shared.post("friends/requests/\(status.friendship_id.id)/cancel") } } }
                        if st == "pending_incoming" { Button("Отклонить") { act { try await API.shared.post("friends/requests/\(status.friendship_id.id)/reject") } } }
                    } label: {
                        Text("[ ··· ]").font(AppFont.mono(11, .medium)).foregroundColor(p.ink)
                    }
                }
            }
        } content: {
            Avatar(url: extras.avatar_url.string ?? pr.avatar_url.string, name: name, size: 88)
            VStack(alignment: .leading, spacing: 8) {
                Text(name).font(AppFont.display(26)).em(-0.01, 26).foregroundColor(p.ink).fixedSize(horizontal: false, vertical: true)
                Text(handle).font(AppFont.mono(12)).em(0.02, 12).foregroundColor(p.inkSoft)
            }
            Group {
                if isSelf {
                    Button("Редактировать профиль") { session.push(.settingsProfile) }.buttonStyle(.outline)
                } else if st == "friends" {
                    Button("✓ В друзьях") {}.buttonStyle(.outline).allowsHitTesting(false)
                } else if st == "pending_outgoing" {
                    Button("Заявка отправлена") {}.buttonStyle(.outline).allowsHitTesting(false)
                } else if st == "pending_incoming" {
                    Button("Принять заявку") { act { try await API.shared.post("friends/requests/\(status.friendship_id.id)/accept") } }
                        .buttonStyle(.primary).disabled(busy)
                } else {
                    Button("+ В друзья") { act { try await API.shared.post("friends/requests", ["user_id": pr["id"].id]) } }
                        .buttonStyle(.primary).disabled(busy)
                }
            }
            ErrorText(text: error)
            HStack(spacing: 16) {
                StatCell(value: extras.friends_count.double.map { Fmt.num($0) } ?? "—", label: "Друзей")
                VRule().frame(height: 44)
                StatCell(value: isSelf ? "—" : Fmt.num(extras.mutual_count.num), label: "Общих")
                VRule().frame(height: 44)
                StatCell(value: extras.subscriptions_count.double.map { Fmt.num($0) } ?? "—", label: "Подписок")
            }
            Rule2()
            SectionLabel("Планирует посетить")
            if upcoming.isEmpty {
                Text(pr.attending_events_visible.isNull || pr.attending_events_visible.bool ? "Пока никуда не собирается." : "Список скрыт настройками приватности.")
                    .font(AppFont.text(13)).foregroundColor(p.inkSoft)
            } else {
                VStack(spacing: 10) {
                    ForEach(Array(upcoming.enumerated()), id: \.offset) { _, x in
                        Button { session.push(.event(x.0["id"].id)) } label: {
                            Leader(label: x.0.title.str, value: "\(Fmt.weekday(x.1.start)) \(Fmt.ddmm(x.1.start))")
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            Rule()
            SectionLabel("Подписки")
            Group {
                if extras.subscriptions_count.isNull {
                    Text("Подписки скрыты настройками приватности.").font(AppFont.text(13)).foregroundColor(p.inkSoft)
                } else if subsNames.isEmpty {
                    Text("Пока ни на кого не подписан(а).").font(AppFont.text(13)).foregroundColor(p.inkSoft)
                } else {
                    Text(subsNames.prefix(5).map { $0.uppercased() }.joined(separator: "  ·  ") + (extras.subscriptions_count.num > 5 ? "  +\(Int(extras.subscriptions_count.num) - 5)" : ""))
                        .font(AppFont.mono(12)).em(0.02, 12).lineSpacing(6).foregroundColor(p.ink)
                }
            }
            Rule()
            if extras.saved_hidden.bool {
                Leader(label: "Сэкономлено", value: "СКРЫТО", valueColor: p.inkSoft)
                Text("\(first) скрыл(а) это в настройках приватности.").font(AppFont.text(13)).foregroundColor(p.inkSoft).padding(.top, -12)
            } else {
                Leader(label: "Сэкономлено", value: Fmt.rub(extras.saved_total.num), valueBold: true)
            }
        }
    }

    private func act(_ fn: @escaping () async throws -> Void) {
        Task {
            busy = true
            error = nil
            defer { busy = false }
            do { try await fn(); await load() } catch { self.error = error.localizedDescription }
        }
    }

    private func load() async {
        let u = username.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? username
        do {
            let pr = try await API.shared.get("users/by-username/\(u)")
            profile = pr
            if pr["id"].int64 != session.user["id"].int64 {
                status = (try? await API.shared.get("friends/status/\(pr["id"].id)")) ?? .null
            }
        } catch {
            if profile == nil { notFound = true }
            return
        }
        extras = (try? await API.shared.get("users/by-username/\(u)/extras")) ?? .null
        events = (try? await API.shared.get("users/by-username/\(u)/attending"))?.array ?? []
    }
}
