import SwiftUI

enum OrderMath {
    /// Экономия по заказу: цена до скидки минус оплачено.
    static func saved(_ o: JSON) -> Double { max(0, o.subtotal.num - o.total_amount.num) }
    static func spent(_ o: JSON) -> Bool { ["paid", "completed"].contains(o.status.str) }
    static func code(_ o: JSON) -> String { "\(Fmt.pad(o["id"].id % 10000, 4)) · \(o.redeem_code.string ?? "····")" }

    static func sortedByDate(_ list: [JSON]) -> [JSON] {
        list.sorted { ($0.created_at.date ?? .distantPast) > ($1.created_at.date ?? .distantPast) }
    }
}

/// Строка «дата · место ....... −экономия».
struct OrderLine: View {
    @Environment(\.palette) private var p
    let date: Date?
    let title: String
    let value: String
    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 8) {
            Text(Fmt.ddmm(date)).foregroundColor(p.inkSoft)
            Text(title.uppercased()).em(0.03, 12).foregroundColor(p.ink).lineLimit(1)
            DashLine().stroke(p.inkFaint, style: StrokeStyle(lineWidth: 1, dash: [3, 3])).frame(height: 1).frame(minWidth: 8)
            Text(value).foregroundColor(p.ink).fixedSize()
        }
        .font(AppFont.mono(12))
    }
}

/// Мои заказы (макет 22): активные с кодами, недавно использованные, возвраты.
struct OrdersView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    @State private var orders: [JSON]?
    @State private var offers: [Int64: JSON] = [:]
    @State private var tab = "active"
    @State private var shown = 5
    @State private var paying: Int64?
    @State private var error: String?

    var body: some View {
        if let orders {
            let active = orders.filter { ["paid", "created"].contains($0.status.str) }
            let used = orders.filter { $0.status.str == "completed" }
            let back = orders.filter { ["refunded", "cancelled"].contains($0.status.str) }
            let rows = tab == "back" ? back : used
            Screen(spacing: 20, onRefresh: load) {
                BackHeader("Профиль")
            } content: {
                Text("ЗАКАЗЫ").font(AppFont.display(30)).em(-0.02, 30).foregroundColor(p.ink)
                ChipTabs(items: [("active", "Активные · \(active.count)"), ("used", "Использованные · \(used.count)"),
                                 ("back", back.isEmpty ? "Возвраты" : "Возвраты · \(back.count)")],
                         value: $tab, scroll: true)
                Rule2()
                if tab == "active" {
                    if active.isEmpty {
                        Text("Активных заказов нет. Возьмите скидку — чек с кодом появится здесь.").font(AppFont.text(15)).foregroundColor(p.inkSoft)
                        Button("К предложениям") { session.open(.home) }.buttonStyle(.bracket)
                    }
                    ForEach(Array(active.enumerated()), id: \.offset) { i, o in
                        if i > 0 { Rule() }
                        activeCard(o)
                    }
                    ErrorText(text: error)
                    Rule2()
                    SectionLabel("Недавно использованные")
                }
                VStack(spacing: 10) {
                    if rows.isEmpty {
                        Text(tab == "back" ? "Возвратов не было." : "Здесь появятся заказы, погашенные на кассе.")
                            .font(AppFont.text(14)).foregroundColor(p.inkSoft).frame(maxWidth: .infinity, alignment: .leading)
                    }
                    ForEach(Array(rows.prefix(tab == "active" ? 3 : shown).enumerated()), id: \.offset) { _, o in
                        Button { session.push(.order(o["id"].id)) } label: {
                            OrderLine(date: o.created_at.date, title: o.company_name.string ?? o.offer_title.str,
                                      value: tab == "back" ? Fmt.rub(o.total_amount.num) : "−" + Fmt.rub(OrderMath.saved(o)))
                        }
                        .buttonStyle(.plain)
                    }
                }
                if tab == "active" {
                    Button("Весь журнал экономии") { session.push(.savings) }.buttonStyle(.bracket).frame(maxWidth: .infinity)
                } else if rows.count > shown {
                    Button("Показать ещё \(min(rows.count - shown, 10))") { shown += 10 }.buttonStyle(.bracket).frame(maxWidth: .infinity)
                }
            }
        } else {
            LoadingScreen("Собираем заказы…") { BackHeader("Профиль") }.task { await load() }
        }
    }

    @ViewBuilder
    private func activeCard(_ o: JSON) -> some View {
        let paid = o.status.str == "paid"
        let place = o.company_name.string ?? o.offer_title.str
        let until = o.offer_id.int64.flatMap { offers[$0]?.end_at.date }
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Meta("№ \(Fmt.pad(o["id"].id)) · \(Fmt.ddmm(o.created_at.date)) \(Fmt.hhmm(o.created_at.date))")
                Spacer()
                Text(paid ? "ОПЛАЧЕН" : "ЖДЁТ ОПЛАТЫ").font(AppFont.mono(11, .bold)).em(0.04, 11).foregroundColor(p.ink)
            }
            Button { session.push(.order(o["id"].id)) } label: {
                VStack(alignment: .leading, spacing: 3) {
                    Text(place.uppercased()).font(AppFont.display(20)).em(-0.01, 20).foregroundColor(p.ink).multilineTextAlignment(.leading)
                    if o.company_name.string != nil, let t = o.offer_title.string { Text(t).font(AppFont.text(14)).foregroundColor(p.inkSoft) }
                }
            }
            .buttonStyle(.plain)
            if paid {
                Leader(label: "Оплачено", value: Fmt.rub(o.total_amount.num))
                Leader(label: "Код", value: OrderMath.code(o), valueBold: true)
                HStack {
                    Meta(until.map { "До \(Fmt.ddmmyy($0))" } ?? "")
                    Spacer()
                    Button("Показать чек") { session.push(.order(o["id"].id)) }.buttonStyle(.bracket)
                }
            } else {
                Leader(label: "К оплате", value: Fmt.rub(o.total_amount.num))
                HStack {
                    Meta("Код после оплаты")
                    Spacer()
                    Button(paying == o["id"].id ? "Оплачиваем…" : "Оплатить") { Task { await pay(o) } }
                        .buttonStyle(.small).disabled(paying != nil)
                }
            }
        }
    }

    private func load() async {
        async let r = try? API.shared.get("orders")
        async let o = try? API.shared.get("offers", ["limit": "500"])
        orders = OrderMath.sortedByDate((await r)?.array ?? [])
        var map: [Int64: JSON] = [:]
        for x in (await o)?.array ?? [] { map[x["id"].id] = x }
        offers = map
    }

    private func pay(_ o: JSON) async {
        paying = o["id"].id
        error = nil
        defer { paying = nil }
        do {
            try await API.shared.post("orders/\(o["id"].id)/confirm")
            session.push(.order(o["id"].id))
        } catch {
            self.error = error.localizedDescription.contains("Недостаточно") ? "Недостаточно средств на кошельке — пополните его и попробуйте снова." : "Не удалось оплатить: \(error.localizedDescription)"
            await load()
        }
    }
}

/// Журнал экономии (макет 04): итог за всё время, столбики по месяцам, операции по месяцам.
struct SavingsView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    @State private var orders: [JSON]?
    @State private var open: Set<Int> = []

    private struct MonthGroup { let key: Int; let title: String; var rows: [JSON] }

    var body: some View {
        if let orders {
            let spent = orders.filter { OrderMath.spent($0) && OrderMath.saved($0) > 0 }
            let total = spent.reduce(0) { $0 + OrderMath.saved($1) }
            let first = spent.last?.created_at.date
            let groups = makeGroups(spent)
            Screen(spacing: 20, onRefresh: load) {
                BackHeader("Кошелёк") {
                    ShareLink(item: csv(spent)) {
                        Text("[ ЭКСПОРТ ]").font(AppFont.mono(11, .medium)).em(0.04, 11).foregroundColor(p.ink)
                    }
                }
            } content: {
                Text("ЖУРНАЛ").font(AppFont.display(30)).em(-0.02, 30).foregroundColor(p.ink)
                SectionLabel("Итого сэкономлено · всё время", color: p.inkSoft)
                Text(Fmt.rub(total)).font(AppFont.display(44)).em(0.01, 44).foregroundColor(p.accent).lineLimit(1).minimumScaleFactor(0.6)
                Meta((first.map { "С \(Fmt.ddmmyy($0)) · " } ?? "") + "\(spent.count) \(Fmt.plural(spent.count, "скидка", "скидки", "скидок"))")
                Rule2()
                MonthChart(months: months(spent, count: 6), height: 80)
                if groups.isEmpty {
                    Text("Здесь появится каждая скидка, которой вы воспользовались.").font(AppFont.text(15)).foregroundColor(p.inkSoft)
                    Button("К предложениям") { session.open(.home) }.buttonStyle(.bracket)
                }
                ForEach(Array(groups.enumerated()), id: \.offset) { i, g in
                    if i > 0 { Rule2() }
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text(g.title.uppercased()).font(AppFont.mono(13, .bold)).em(0.08, 13).foregroundColor(p.ink)
                            Spacer()
                            Meta("\(g.rows.count) опер.")
                        }
                        VStack(spacing: 10) {
                            ForEach(Array((open.contains(g.key) ? g.rows : Array(g.rows.prefix(10))).enumerated()), id: \.offset) { _, o in
                                Button { session.push(.order(o["id"].id)) } label: {
                                    OrderLine(date: o.created_at.date, title: o.company_name.string ?? o.offer_title.str, value: "−" + Fmt.rub(OrderMath.saved(o)))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        if g.rows.count > 10 && !open.contains(g.key) {
                            Button("Показать все \(g.rows.count)") { open.insert(g.key) }.buttonStyle(.bracket).frame(maxWidth: .infinity)
                        }
                        Rule()
                        Leader(label: "Сэкономлено", value: Fmt.rub(g.rows.reduce(0) { $0 + OrderMath.saved($1) }), strong: true)
                    }
                }
            }
        } else {
            LoadingScreen("Считаем экономию…") { BackHeader("Кошелёк") }.task { await load() }
        }
    }

    private func monthKey(_ d: Date) -> Int {
        let c = Calendar.current
        return c.component(.year, from: d) * 12 + c.component(.month, from: d) - 1
    }

    private func makeGroups(_ spent: [JSON]) -> [MonthGroup] {
        var groups: [MonthGroup] = []
        for o in spent {
            guard let d = o.created_at.date else { continue }
            let k = monthKey(d)
            if let i = groups.firstIndex(where: { $0.key == k }) {
                groups[i].rows.append(o)
            } else {
                let c = Calendar.current
                groups.append(MonthGroup(key: k, title: "\(Fmt.monthsNom[c.component(.month, from: d) - 1]) \(c.component(.year, from: d))", rows: [o]))
            }
        }
        return groups
    }

    private func months(_ spent: [JSON], count: Int) -> [MonthChart.Bar] {
        let c = Calendar.current
        let now = Date()
        return (0..<count).reversed().map { i in
            let d = c.date(byAdding: .month, value: -i, to: now)!
            let k = monthKey(d)
            let v = spent.filter { $0.created_at.date.map(monthKey) == k }.reduce(0) { $0 + OrderMath.saved($1) }
            return MonthChart.Bar(label: Fmt.monthsShort[c.component(.month, from: d) - 1], value: v)
        }
    }

    private func csv(_ spent: [JSON]) -> String {
        var s = "Дата;Место;Предложение;Цена;Оплачено;Экономия\n"
        for o in spent {
            s += [Fmt.ddmmyy(o.created_at.date), o.company_name.str, o.offer_title.str, Fmt.num(o.subtotal.num), Fmt.num(o.total_amount.num), Fmt.num(OrderMath.saved(o))].joined(separator: ";") + "\n"
        }
        return s
    }

    private func load() async {
        orders = OrderMath.sortedByDate((try? await API.shared.get("orders"))?.array ?? [])
    }
}

/// Столбики по месяцам: текущий — залитый, прошлые — пунктирные.
struct MonthChart: View {
    @Environment(\.palette) private var p
    struct Bar { let label: String; let value: Double }
    let months: [Bar]
    var height: CGFloat = 120
    var body: some View {
        let maxV = max(1, months.map(\.value).max() ?? 1)
        HStack(alignment: .bottom, spacing: 8) {
            ForEach(Array(months.enumerated()), id: \.offset) { i, m in
                let current = i == months.count - 1
                let h = m.value > 0 ? max(6, CGFloat(m.value / maxV) * height) : 2
                VStack(spacing: 6) {
                    Group {
                        if current {
                            Rectangle().fill(p.ink)
                        } else {
                            Rectangle().strokeBorder(p.ink, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                        }
                    }
                    .frame(height: h)
                    Text(m.label).font(AppFont.mono(10, current ? .bold : .regular)).em(0.04, 10).foregroundColor(current ? p.ink : p.inkSoft)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .frame(height: height + 20, alignment: .bottom)
    }
}
