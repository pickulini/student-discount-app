import SwiftUI

/// Друзья (макет 52): поиск, новые заявки, все друзья.
struct FriendsView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session

    @State private var data: JSON?
    @State private var tab = "friends"
    @State private var query = ""
    @State private var results: [JSON]?
    @State private var busy = false
    @State private var sent: Set<Int64> = []
    @State private var error: String?

    var body: some View {
        if let data {
            let friends = data.friends.array.sorted { ($0.activity.isNull ? 1 : 0, $0.full_name.str) < ($1.activity.isNull ? 1 : 0, $1.full_name.str) }
            let incoming = data.incoming.array
            let outgoing = data.outgoing.array
            Screen(spacing: 20, onRefresh: load) {
                BackHeader("Профиль")
            } content: {
                Text("ДРУЗЬЯ").font(AppFont.display(34)).em(-0.02, 34).foregroundColor(p.ink)
                ChipTabs(items: [("friends", "Друзья · \(friends.count)"), ("incoming", "Заявки · \(incoming.count)"), ("outgoing", "Исходящие · \(outgoing.count)")],
                         value: $tab, scroll: true)
                HStack(spacing: 10) {
                    Text("ПОИСК:").font(AppFont.mono(12, .bold)).em(0.04, 12).foregroundColor(p.ink)
                    TextField("", text: $query, prompt: Text("@username или имя").foregroundColor(p.inkFaint))
                        .font(AppFont.text(15)).foregroundColor(p.ink)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                        .submitLabel(.search).onSubmit { Task { await search() } }
                    MonoLink(text: "Найти", bold: true) { Task { await search() } }
                }
                .padding(.bottom, 10)
                .overlay(alignment: .bottom) { Rectangle().fill(p.ink).frame(height: 1) }
                ErrorText(text: error)
                if let results {
                    HStack {
                        SectionLabel("Найдено · \(results.count)")
                        Spacer()
                        Button("Сбросить") { self.results = nil; query = "" }.buttonStyle(.bracket(11))
                    }
                    if results.isEmpty { Text("Никого не нашли. Проверьте @username.").font(AppFont.text(15)).foregroundColor(p.inkSoft) }
                    list(results) { r in
                        if friends.contains(where: { $0["id"].id == r["id"].id }) {
                            Text("→").font(AppFont.mono(13)).foregroundColor(p.ink)
                        } else if let inc = incoming.first(where: { $0["id"].id == r["id"].id }) {
                            requestButtons(inc)
                        } else {
                            addButton(r, outgoing: outgoing)
                        }
                    }
                } else if tab == "friends" {
                    Rule2()
                    if !incoming.isEmpty {
                        HStack {
                            SectionLabel("Новые заявки")
                            Spacer()
                            Button { tab = "incoming" } label: { Meta("Все \(incoming.count) →") }.buttonStyle(.plain)
                        }
                        PersonRow(user: incoming[0], meta: meta(incoming[0]), size: 48) { requestButtons(incoming[0]) }
                        Rule2()
                    }
                    SectionLabel("Все друзья · \(friends.count)")
                    if friends.isEmpty {
                        Text("Пока нет друзей. Найдите знакомых по @username или примите заявки.").font(AppFont.text(15)).foregroundColor(p.inkSoft)
                    }
                    list(friends) { _ in Text("→").font(AppFont.mono(13)).foregroundColor(p.ink) }
                } else if tab == "incoming" {
                    if incoming.isEmpty { Text("Новых заявок нет.").font(AppFont.text(14)).foregroundColor(p.inkSoft) }
                    list(incoming) { requestButtons($0) }
                } else {
                    if outgoing.isEmpty { Text("Вы никому не отправляли заявок.").font(AppFont.text(14)).foregroundColor(p.inkSoft) }
                    list(outgoing) { o in
                        Button("Отменить") { run { try await API.shared.post("friends/requests/\(o.request_id.id)/cancel") } }.buttonStyle(.bracket(11)).disabled(busy)
                    }
                }
            }
        } else {
            LoadingScreen("Собираем друзей…") { BackHeader("Профиль") }.task { await load() }
        }
    }

    private func meta(_ u: JSON) -> String {
        [u.username.string.map { "@\($0)" }, u.university.string, u.mutual.num > 0 ? "\(Int(u.mutual.num)) \(Fmt.plural(Int(u.mutual.num), "общий", "общих", "общих"))" : nil]
            .compactMap { $0 }.joined(separator: " · ")
    }

    private func list<R: View>(_ items: [JSON], @ViewBuilder right: @escaping (JSON) -> R) -> some View {
        VStack(spacing: 16) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, u in
                if i > 0 { Rule() }
                PersonRow(user: u, meta: meta(u), sub: u.activity.string, size: 48) { right(u) }
            }
        }
    }

    private func requestButtons(_ r: JSON) -> some View {
        HStack(spacing: 10) {
            Button("Принять") { run { try await API.shared.post("friends/requests/\(r.request_id.id)/accept") } }.buttonStyle(.small).disabled(busy)
            Button { run { try await API.shared.post("friends/requests/\(r.request_id.id)/reject") } } label: {
                Text("✕").font(AppFont.mono(13, .bold)).foregroundColor(p.inkSoft).frame(width: 28, height: 28)
            }
            .buttonStyle(.plain).disabled(busy)
        }
    }

    @ViewBuilder
    private func addButton(_ u: JSON, outgoing: [JSON]) -> some View {
        if sent.contains(u["id"].id) || outgoing.contains(where: { $0["id"].id == u["id"].id }) {
            Text("ЗАЯВКА ОТПРАВЛЕНА").font(AppFont.mono(11)).em(0.04, 11).foregroundColor(p.inkSoft)
        } else {
            MonoLink(text: "+ Добавить", bold: true) {
                run {
                    try await API.shared.post("friends/requests", ["user_id": u["id"].id])
                    sent.insert(u["id"].id)
                }
            }
        }
    }

    private func run(_ fn: @escaping () async throws -> Void) {
        Task {
            busy = true
            error = nil
            defer { busy = false }
            do { try await fn(); await load() } catch { self.error = error.localizedDescription }
        }
    }

    private func search() async {
        let q = query.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "@", with: "")
        guard !q.isEmpty else { results = nil; return }
        results = (try? await API.shared.get("friends/search", ["q": q]))?.array ?? []
    }

    private func load() async {
        data = (try? await API.shared.get("friends/overview")) ?? JSON.object(["friends": .array([]), "incoming": .array([]), "outgoing": .array([])])
    }
}

/// Подписки (макет 53): места, на которые подписаны; ✓ — отписаться.
struct SubscriptionsView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    @State private var list: [JSON]?
    @State private var off: Set<Int64> = []
    @State private var busy: Int64?

    var body: some View {
        if let list {
            Screen(spacing: 20, onRefresh: load) {
                BackHeader("Профиль")
            } content: {
                Text("ПОДПИСКИ").font(AppFont.display(34)).em(-0.02, 34).foregroundColor(p.ink)
                Text("Первыми узнаёте о новых скидках этих мест.").font(AppFont.text(14)).foregroundColor(p.inkSoft).padding(.top, -6)
                Rule2()
                if list.isEmpty {
                    Text("Вы пока ни на кого не подписаны. Откройте предложение и нажмите «Подписаться» у места.").font(AppFont.text(14)).foregroundColor(p.inkSoft)
                } else {
                    ForEach(Array(list.enumerated()), id: \.offset) { i, c in
                        if i > 0 { Rule() }
                        row(c)
                    }
                    Rule2()
                    Text("✓ — вы подписаны. Нажмите, чтобы отписаться.").font(AppFont.text(12)).foregroundColor(p.inkSoft).frame(maxWidth: .infinity)
                }
                Button("Найти ещё места") { session.open(.home) }.buttonStyle(.bracket).frame(maxWidth: .infinity)
            }
        } else {
            LoadingScreen("Загружаем подписки…") { BackHeader("Профиль") }.task { await load() }
        }
    }

    private func row(_ c: JSON) -> some View {
        let kind = (c.description.string ?? c.category.str).components(separatedBy: CharacterSet(charactersIn: ".,\n")).first?.trimmingCharacters(in: .whitespaces) ?? ""
        let sub = [kind.isEmpty ? nil : kind.prefix(1).uppercased() + kind.dropFirst(),
                   c.locations.num > 1 ? "\(Int(c.locations.num)) \(Fmt.plural(Int(c.locations.num), "точка", "точки", "точек"))" : nil]
            .compactMap { $0 }.joined(separator: " · ")
        let counts = [c.offers.num > 0 ? "\(Int(c.offers.num)) \(Fmt.plural(Int(c.offers.num), "оффер", "оффера", "офферов"))" : nil,
                      c.events.num > 0 ? "\(Int(c.events.num)) \(Fmt.plural(Int(c.events.num), "ивент", "ивента", "ивентов"))" : nil].compactMap { $0 }
        let best = c.best_percent.num > 0 ? "−\(Fmt.num(c.best_percent.num))%" : c.best_fixed.num > 0 ? "−\(Fmt.num(c.best_fixed.num)) ₽" : ""
        let bestLabel = !best.isEmpty && c.offers.num > 1 ? "ДО \(best)" : best
        let subscribed = !off.contains(c["id"].id)
        return HStack(spacing: 14) {
            Photo(url: c.cover.string, height: 52, seed: Int(c["id"].id)).frame(width: 52)
            VStack(alignment: .leading, spacing: 3) {
                Text(c.name.str.uppercased()).font(AppFont.display(15)).em(-0.01, 15).foregroundColor(p.ink).lineLimit(1)
                if !sub.isEmpty { Text(sub).font(AppFont.text(13)).foregroundColor(p.inkSoft).lineLimit(1) }
                HStack(spacing: 8) {
                    Text(counts.isEmpty ? "НЕТ АКЦИЙ" : counts.joined(separator: " · ").uppercased()).foregroundColor(p.ink)
                    if !bestLabel.isEmpty { Text(bestLabel).bold().foregroundColor(p.accent) }
                }
                .font(AppFont.mono(11)).em(0.03, 11)
            }
            Spacer(minLength: 0)
            Button { Task { await toggle(c) } } label: {
                Text(subscribed ? "✓" : "+").font(.system(size: 18)).foregroundColor(subscribed ? p.ink : p.inkFaint).frame(width: 32, height: 32)
            }
            .buttonStyle(.plain).disabled(busy == c["id"].id)
            .accessibilityLabel(subscribed ? "Отписаться" : "Подписаться")
        }
    }

    private func toggle(_ c: JSON) async {
        let id = c["id"].id
        busy = id
        defer { busy = nil }
        do {
            if off.contains(id) {
                try await API.shared.post("companies/\(id)/subscribe")
                off.remove(id)
            } else {
                try await API.shared.delete("companies/\(id)/subscribe")
                off.insert(id)
            }
        } catch {}
    }

    private func load() async {
        list = (try? await API.shared.get("subscriptions/overview"))?.array ?? []
        off = []
    }
}

/// Уведомления (макет 54): категории, лента по дням, заявки в друзья прямо здесь.
struct NotificationsView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    @State private var items: [JSON]?
    @State private var more = true
    @State private var cat = "all"
    @State private var handled: Set<Int64> = []

    private static let cats: [(String, String, [String])] = [
        ("orders", "Заказы", ["order_paid", "order_refunded"]),
        ("offers", "Офферы", ["new_offer", "offer_admin_edited"]),
        ("events", "Ивенты", ["new_event", "friend_going", "event_reminder"]),
        ("friends", "Друзья", ["friend_request", "friend_accepted"]),
        ("verification", "Верификация", ["verification_done", "verification_rejected"]),
        ("bonus", "Бонусы", ["bonus_credited"]),
        ("support", "Поддержка", ["support_reply"]),
    ]

    private func catOf(_ n: JSON) -> String { Self.cats.first { $0.2.contains(n.type.str) }?.0 ?? "other" }
    private func catLabel(_ n: JSON) -> String {
        switch catOf(n) {
        case "offers": return "Оффер"
        case "events": return "Ивент"
        case "orders": return "Заказ"
        case "other": return "Сервис"
        default: return Self.cats.first { $0.0 == catOf(n) }?.1 ?? ""
        }
    }

    private func dayLabel(_ d: Date) -> String {
        let c = Calendar.current
        if c.isDateInToday(d) { return "Сегодня · \(Fmt.ddmm(d))" }
        if c.isDateInYesterday(d) { return "Вчера · \(Fmt.ddmm(d))" }
        return "\(Fmt.weekday(d).capitalized) · \(Fmt.ddmm(d))"
    }

    var body: some View {
        if let items {
            let unread = items.filter { $0.read_at.isNull }.count
            let visible = cat == "all" ? items : items.filter { catOf($0) == cat }
            let groups = Dictionary(grouping: visible) { Calendar.current.startOfDay(for: $0.created_at.date ?? Date()) }.sorted { $0.key > $1.key }
            Screen(spacing: 20, onRefresh: { await load(0) }) {
                BackHeader("Профиль") {
                    Button("Прочитать все") { Task { await readAll() } }.buttonStyle(.bracket(11)).disabled(unread == 0)
                }
            } content: {
                Text("УВЕДОМЛЕНИЯ").font(AppFont.display(34)).em(-0.02, 34).foregroundColor(p.ink).lineLimit(1).minimumScaleFactor(0.7)
                ChipTabs(items: [("all", unread > 0 ? "Все · \(unread)" : "Все")] + Self.cats.map { ($0.0, $0.1) }, value: $cat, scroll: true)
                Rule2()
                if groups.isEmpty {
                    Text(cat == "all" ? "Уведомлений пока нет." : "В этой категории пока пусто.").font(AppFont.text(15)).foregroundColor(p.inkSoft)
                }
                ForEach(Array(groups.enumerated()), id: \.offset) { gi, g in
                    if gi > 0 { Rule2() }
                    SectionLabel(dayLabel(g.key))
                    VStack(spacing: 14) {
                        ForEach(Array(g.value.enumerated()), id: \.offset) { i, n in
                            if i > 0 { Rule() }
                            row(n)
                        }
                    }
                }
                if more && !items.isEmpty {
                    Button("Показать ещё") { Task { await load(items.count) } }.buttonStyle(.bracket).frame(maxWidth: .infinity)
                }
            }
        } else {
            LoadingScreen("Загружаем уведомления…") { BackHeader("Профиль") }.task { await load(0) }
        }
    }

    private func row(_ n: JSON) -> some View {
        let unread = n.read_at.isNull
        let text = [n.title.string, n.body.string].compactMap { $0 }.joined(separator: ". ").replacingOccurrences(of: "..", with: ".")
        let isRequest = n.type.str == "friend_request" && n.reference_id.int64 != nil && !handled.contains(n["id"].id)
        return HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(Fmt.hhmm(n.created_at.date)).font(AppFont.mono(13, .bold)).foregroundColor(unread ? p.ink : p.inkSoft)
                if unread { Circle().fill(p.ink).frame(width: 5, height: 5) }
            }
            .frame(width: 42, alignment: .leading)
            VStack(alignment: .leading, spacing: 6) {
                Text(catLabel(n).uppercased()).font(AppFont.mono(10, .medium)).em(0.06, 10).foregroundColor(p.inkSoft)
                Button { open(n) } label: {
                    Text(text).font(AppFont.text(15)).lineSpacing(4).foregroundColor(unread ? p.ink : p.inkSoft).multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                if isRequest {
                    HStack(spacing: 14) {
                        Button("Принять") { Task { await respond(n, accept: true) } }.buttonStyle(.small)
                        MonoLink(text: "Отклонить", color: p.inkSoft) { Task { await respond(n, accept: false) } }
                    }
                    .padding(.top, 4)
                }
            }
        }
    }

    /// Ссылка уведомления (как на сайте) → экран приложения.
    private func route(for link: String) -> Route? {
        let parts = link.split(separator: "/").map(String.init)
        guard let first = parts.first else { return nil }
        let id = parts.count > 1 ? Int64(parts[1]) : nil
        switch first {
        case "orders": return id.map { .order($0) } ?? .orders
        case "order": return .orders
        case "offers": return id.map { .offer($0) }
        case "events": return id.map { .event($0) }
        case "friends": return .friends
        case "support": return .support(topic: nil)
        case "verification", "settings": return first == "verification" ? .verification(afterRegister: false) : .settings
        case "wallet": return nil
        case "referral": return .referral
        default: return first.hasPrefix("@") ? .user(String(first.dropFirst())) : nil
        }
    }

    private func open(_ n: JSON) {
        markRead(n)
        let link = n.link.str
        if link.hasPrefix("/wallet") { session.open(.wallet); return }
        if let r = route(for: link) { session.push(r) }
    }

    private func markRead(_ n: JSON) {
        guard n.read_at.isNull, let items else { return }
        self.items = items.map { $0["id"].id == n["id"].id ? merge($0, read: true) : $0 }
        Task {
            try? await API.shared.post("notifications/\(n["id"].id)/read")
            await session.refreshUnread()
        }
    }

    private func merge(_ n: JSON, read: Bool) -> JSON {
        var o = n.object
        o["read_at"] = .string(ISO8601DateFormatter().string(from: Date()))
        return .object(o)
    }

    private func respond(_ n: JSON, accept: Bool) async {
        handled.insert(n["id"].id)
        try? await API.shared.post("friends/requests/\(n.reference_id.id)/\(accept ? "accept" : "reject")")
        markRead(n)
    }

    private func readAll() async {
        try? await API.shared.post("notifications/read-all")
        items = items?.map { $0.read_at.isNull ? merge($0, read: true) : $0 }
        await session.refreshUnread()
    }

    private func load(_ offset: Int) async {
        let page = 30
        let list = (try? await API.shared.get("notifications", ["limit": "\(page)", "offset": "\(offset)"]))?.array ?? []
        items = offset == 0 ? list : (items ?? []) + list
        more = list.count == page
    }
}
