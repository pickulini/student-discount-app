import SwiftUI

/// Ивенты (макет 30): табы, полоса дней, лента по дням.
struct EventsView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session

    @State private var events: [JSON]?
    @State private var mine: [JSON] = []
    @State private var meta: [String: JSON] = [:]
    @State private var tab = "all"
    @State private var selected = Calendar.current.startOfDay(for: Date())
    private let days = 14

    private var windowStart: Date { Calendar.current.date(byAdding: .day, value: -1, to: Calendar.current.startOfDay(for: Date()))! }

    private func status(_ e: JSON) -> String { meta[e["id"].str]?.my_status.string ?? e.my_attendee_status.str }

    private struct Occ { let start: Date; let event: JSON }

    private var list: [Occ] {
        let source = tab == "mine" ? mine : (events ?? [])
        let filtered = source.filter { tab != "going" || ["going", "interested"].contains(status($0)) }
        var out: [Occ] = []
        if tab == "mine" {
            for e in filtered { out.append(Occ(start: EventsCore.next(e).start, event: e)) }
        } else {
            let end = Calendar.current.date(byAdding: .day, value: days, to: windowStart)!
            for e in filtered {
                for o in EventsCore.occurrences(e, from: windowStart, to: end) { out.append(Occ(start: o.start, event: e)) }
            }
        }
        return out.sorted { $0.start < $1.start }
    }

    var body: some View {
        let all = list
        let busyDays = Set(all.map { Calendar.current.startOfDay(for: $0.start) })
        let visible = tab == "mine" ? all : all.filter { $0.start >= selected }
        let groups = Dictionary(grouping: visible) { Calendar.current.startOfDay(for: $0.start) }.sorted { $0.key < $1.key }
        let goingCount = (events ?? []).filter { status($0) == "going" }.count

        Screen(spacing: 20, onRefresh: load) {
            TabHeader()
        } content: {
            Text("ИВЕНТЫ").font(AppFont.display(34)).em(-0.02, 34).foregroundColor(p.ink)
            ChipTabs(items: [("all", "Все"), ("going", goingCount > 0 ? "Я иду · \(goingCount)" : "Я иду"), ("mine", "Мои")], value: $tab)
            if tab != "mine" {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 0) {
                        ForEach(0..<days, id: \.self) { i in
                            let d = Calendar.current.date(byAdding: .day, value: i, to: windowStart)!
                            let active = Calendar.current.isDate(d, inSameDayAs: selected)
                            Button { selected = d } label: {
                                VStack(spacing: 2) {
                                    Text(Fmt.weekday(d)).font(AppFont.mono(10)).em(0.04, 10).foregroundColor(active ? p.onInk : p.inkSoft)
                                    Text("\(Calendar.current.component(.day, from: d))").font(AppFont.display(20)).foregroundColor(active ? p.onInk : p.ink)
                                    Text(busyDays.contains(d) ? "•" : " ").font(AppFont.mono(10)).foregroundColor(active ? p.onInk : p.ink).frame(height: 10)
                                }
                                .frame(width: 50).padding(.vertical, 8)
                                .background(active ? p.ink : Color.clear)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .padding(.horizontal, -20)
            }
            Rule2()
            if events == nil {
                LoadingView(label: "Собираем афишу…").frame(height: 240)
            } else if groups.isEmpty {
                Text(tab == "mine" ? "Вы ещё не предлагали ивентов." : tab == "going" ? "В эти дни вы никуда не записаны." : "В эти дни ивентов нет.")
                    .font(AppFont.text(15)).foregroundColor(p.inkSoft)
            } else {
                ForEach(Array(groups.enumerated()), id: \.offset) { gi, g in
                    if gi > 0 { Rule2() }
                    SectionLabel(Fmt.dayTitle(g.key))
                    ForEach(Array(g.value.enumerated()), id: \.offset) { i, o in
                        if i > 0 { Rule() }
                        row(o)
                    }
                }
            }
            Rule()
            Button("+ Предложить ивент") { session.push(.eventNew) }.buttonStyle(.bracket).frame(maxWidth: .infinity)
        }
        .task { if events == nil { await load() } }
    }

    private static let statusLabel = ["draft": "Черновик", "pending_review": "На модерации", "rejected": "Отклонён",
                                      "published": "Опубликован", "expired": "Прошёл", "archived": "В архиве"]

    private func row(_ o: Occ) -> some View {
        let e = o.event
        let m = meta[e["id"].str] ?? .null
        let price = EventsCore.price(e, m)
        let place = [m.company_name.string ?? e.address.string, EventsCore.recurrenceLabel(e)].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
        let st = status(e)
        return Button { session.push(.event(e["id"].id)) } label: {
            HStack(alignment: .top, spacing: 16) {
                Text(Fmt.hhmm(o.start)).font(AppFont.mono(14, .bold)).foregroundColor(p.ink).frame(width: 46, alignment: .leading).padding(.top, 1)
                VRule()
                VStack(alignment: .leading, spacing: 6) {
                    Text(e.title.str.uppercased()).font(AppFont.display(15)).em(-0.01, 15).foregroundColor(p.ink).multilineTextAlignment(.leading)
                    if !place.isEmpty { Text(place).font(AppFont.text(13)).foregroundColor(p.inkSoft).lineLimit(1) }
                    HStack(spacing: 10) {
                        Text(EventsCore.priceLabel(price)).font(AppFont.mono(11, .bold)).foregroundColor(price > 0 ? p.ink : p.accent)
                        if tab == "mine" {
                            Text((Self.statusLabel[e.status.str] ?? e.status.str).uppercased()).font(AppFont.mono(11, .bold)).foregroundColor(p.inkSoft)
                        } else {
                            Text("ИДУТ \(e.attendees_count.int ?? 0)").font(AppFont.mono(11)).foregroundColor(p.inkSoft)
                            if st == "going" { Text("✓ Я ИДУ").font(AppFont.mono(11, .bold)).foregroundColor(p.ink) }
                            if st == "interested" { Text("? ДУМАЮ").font(AppFont.mono(11, .bold)).foregroundColor(p.inkSoft) }
                        }
                    }
                    .em(0.02, 11)
                    .padding(.top, 2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Photo(url: e.image_url.string, height: 64, seed: Int(e["id"].id) + 3).frame(width: 64)
            }
            .fixedSize(horizontal: false, vertical: true)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func load() async {
        async let a = try? API.shared.get("events", ["limit": "200"])
        async let m = try? API.shared.get("events/my")
        let all = (await a)?.array ?? []
        let my = (await m)?.array ?? []
        events = all
        mine = my
        meta = await EventsCore.meta(Array(Set((all + my).map { $0["id"].id })))
    }
}
