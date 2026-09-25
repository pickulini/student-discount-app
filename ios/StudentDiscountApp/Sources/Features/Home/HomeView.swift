import SwiftUI

/// Главная (макет 01): «Вы сэкономили», поиск, теги, «Популярное», все предложения, ивенты недели.
struct HomeView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    @StateObject private var geo = LocationProvider.shared

    @State private var offers: [JSON]?
    @State private var events: [JSON] = []
    @State private var orders: [JSON] = []
    @State private var wallet: JSON = .null
    @State private var search = ""
    @State private var tag = ""
    @State private var shown = 6
    @State private var now = Date()

    private func benefit(_ o: JSON) -> Double {
        o.discount_type.str == "percentage" ? o.base_price.num * o.discount_value.num / 100 : o.discount_value.num
    }

    private var categories: [(String, String)] {
        var count: [String: (String, Int)] = [:]
        for o in offers ?? [] {
            for t in o.tags.array {
                let slug = t.slug.str
                count[slug] = (t.name.str, (count[slug]?.1 ?? 0) + 1)
            }
        }
        return count.sorted { $0.value.1 > $1.value.1 }.prefix(8).map { ($0.key, $0.value.0) }
    }

    private var filtered: [JSON] {
        let q = search.trimmingCharacters(in: .whitespaces).lowercased()
        return (offers ?? []).filter { o in
            if !tag.isEmpty && !o.tags.array.contains(where: { $0.slug.str == tag }) { return false }
            if q.isEmpty { return true }
            let hay = [o.title.str, o.description.str, o.company_name.str, o.address.str] + o.tags.array.map { $0.name.str }
            return hay.contains { $0.lowercased().contains(q) }
        }
    }

    private var sorted: [JSON] {
        if geo.location != nil {
            return filtered.sorted { (geo.distance(to: $0) ?? .infinity) < (geo.distance(to: $1) ?? .infinity) }
        }
        return filtered.sorted { benefit($0) > benefit($1) }
    }

    private var popular: [JSON] {
        let pool = geo.location != nil ? filtered : (offers ?? [])
        let s = geo.location != nil
            ? pool.sorted { (geo.distance(to: $0) ?? .infinity) < (geo.distance(to: $1) ?? .infinity) }
            : pool.sorted { $0.current_uses.num > $1.current_uses.num }
        return Array(s.prefix(6))
    }

    private var savings: (month: Double, count: Int) {
        let cal = Calendar.current
        let paid = orders.filter { ["paid", "completed"].contains($0.status.str) }
        let month = paid.filter { o in o.created_at.date.map { cal.isDate($0, equalTo: now, toGranularity: .month) } ?? false }
        let sum = month.reduce(0) { $0 + $1.discount_amount.num + $1.bonus_amount.num }
        return (sum, month.count)
    }

    var body: some View {
        Screen(spacing: 20, onRefresh: load) {
            TabHeader()
        } content: {
            HStack {
                Text("ЧЕК № \(Fmt.pad(session.user["id"].id))")
                Spacer()
                Text("\(Fmt.ddmmyy(now))  \(Fmt.hhmm(now))")
            }
            .font(AppFont.mono(11)).em(0.04, 11).foregroundColor(p.inkSoft)
            .padding(.top, -6)
            Rule2()

            VStack(alignment: .leading, spacing: 10) {
                SectionLabel("Вы сэкономили · \(Fmt.monthsNom[Calendar.current.component(.month, from: now) - 1])", color: p.inkSoft)
                Button { session.push(.savings) } label: {
                    Text(Fmt.rub(savings.month)).font(AppFont.display(48)).em(-0.03, 48).foregroundColor(p.ink)
                        .lineLimit(1).minimumScaleFactor(0.6)
                }
                .buttonStyle(.plain)
                VStack(spacing: 8) {
                    Leader(label: "Скидок использовано", value: "\(savings.count)")
                    Leader(label: "Бонусов на счёте", value: "\(Int(wallet.bonus.num))")
                }
                .padding(.top, 4)
            }
            Rule()

            HStack(spacing: 10) {
                Text("ПОИСК:").font(AppFont.mono(12, .bold)).em(0.04, 12).foregroundColor(p.ink)
                TextField("", text: $search, prompt: Text("кофе, кино, спорт…").foregroundColor(p.inkFaint))
                    .font(AppFont.text(15)).foregroundColor(p.ink)
                    .submitLabel(.search)
                if !search.isEmpty {
                    Button { search = "" } label: { Text("✕").font(AppFont.mono(12)).foregroundColor(p.inkSoft) }.buttonStyle(.plain)
                }
            }
            ChipTabs(items: [("", "#все")] + categories.map { ($0.0, "#" + $0.1) }, value: $tag, scroll: true)
            Rule2()

            if offers == nil {
                LoadingView(label: "Загрузка предложений…").frame(height: 240)
            } else if filtered.isEmpty {
                EmptyState(title: tag.isEmpty && search.isEmpty ? "Предложений пока нет" : "По выбранным условиям ничего нет")
                if !tag.isEmpty || !search.isEmpty {
                    Button("Сбросить") { tag = ""; search = "" }.buttonStyle(.bracket).frame(maxWidth: .infinity)
                }
            } else {
                HStack {
                    SectionLabel(geo.location != nil ? "Популярное рядом" : "Популярное")
                    Spacer()
                    if geo.location == nil {
                        Button { geo.request() } label: { Meta("Где я? →") }.buttonStyle(.plain)
                    }
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 14) {
                        ForEach(Array(popular.enumerated()), id: \.offset) { i, o in
                            if i > 0 { VRule() }
                            MiniOfferCard(offer: o, distance: geo.distance(to: o))
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .padding(.horizontal, -20)
                Rule2()
                HStack {
                    SectionLabel("Все предложения")
                    Spacer()
                    Meta("\(filtered.count) поз.")
                }
                ForEach(Array(sorted.prefix(shown).enumerated()), id: \.offset) { i, o in
                    if i > 0 { Rule() }
                    OfferCard(offer: o, index: i, distance: geo.distance(to: o))
                }
                if !events.isEmpty {
                    Rule2()
                    HStack {
                        SectionLabel("Ивенты")
                        Spacer()
                        Button { session.tab = .events } label: { Meta("Неделя") }.buttonStyle(.plain)
                    }
                    ForEach(Array(events.prefix(2).enumerated()), id: \.offset) { i, e in
                        if i > 0 { Rule() }
                        EventCard(event: e)
                    }
                }
                VStack(spacing: 14) {
                    Meta("Показано \(min(shown, filtered.count)) из \(filtered.count)")
                    if shown < filtered.count {
                        Button("Печатать дальше") { shown += 6 }.buttonStyle(.primary)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
        }
        .task { if offers == nil { await load() } }
        .onChange(of: tag) { _ in shown = 6 }
    }

    private func load() async {
        now = Date()
        async let o = try? API.shared.get("offers")
        async let e = try? API.shared.get("events", ["limit": "10"])
        async let r = try? API.shared.get("orders")
        async let w = try? API.shared.get("wallet")
        offers = (await o)?.array ?? offers ?? []
        events = ((await e)?.array ?? []).filter { ($0.start_at.date ?? .distantPast) > Date() }
        orders = (await r)?.array ?? []
        wallet = await w ?? .null
    }
}
