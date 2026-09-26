import SwiftUI

/// Сводка по моим ивентам — блок во вкладке «Мои».
struct MyEventsSummary: View {
    @Environment(\.palette) private var p
    let totals: JSON

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionLabel("Статистика организатора", color: p.inkSoft)
            HStack(alignment: .top, spacing: 16) {
                StatCell(value: Fmt.num(totals.viewers.num), label: "Просмотров")
                VRule().frame(height: 44)
                StatCell(value: Fmt.num(totals.going.num), label: "Идут", accent: true)
                VRule().frame(height: 44)
                StatCell(value: Fmt.num(totals.interested.num), label: "Думают")
            }
            VStack(spacing: 10) {
                Leader(label: "Ивентов", value: "\(totals.events.int ?? 0) · \(totals.upcoming.int ?? 0) впереди")
                if (totals.pending.int ?? 0) > 0 { Leader(label: "На модерации", value: "\(totals.pending.int ?? 0)") }
                if (totals.going_7d.int ?? 0) > 0 { Leader(label: "Новых «Пойду» за неделю", value: "+\(totals.going_7d.int ?? 0)", valueColor: p.accent) }
                if (totals.tickets.int ?? 0) > 0 {
                    Leader(label: "Билетов продано", value: "\(totals.tickets.int ?? 0)")
                    Leader(label: "Выручка", value: Fmt.rub(totals.revenue.num), valueBold: true)
                }
            }
        }
    }
}

/// Строка «моего» ивента с цифрами.
struct MyEventStatRow: View {
    @Environment(\.palette) private var p
    let e: JSON

    static let statusLabel = ["draft": "Черновик", "pending_review": "На модерации", "pending_partner_approval": "На модерации",
                              "rejected": "Отклонён", "published": "Опубликован", "expired": "Прошёл", "archived": "В архиве"]

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(e.title.str.uppercased()).font(AppFont.display(15)).em(-0.01, 15).foregroundColor(p.ink).multilineTextAlignment(.leading)
                HStack(spacing: 10) {
                    Text(e.start_at.date.map { "\(Fmt.ddmm($0)) \(Fmt.hhmm($0))" } ?? "—")
                    Text((Self.statusLabel[e.status.str] ?? e.status.str).uppercased()).bold()
                        .foregroundColor(e.status.str == "rejected" ? p.accent : p.inkSoft)
                }
                .font(AppFont.mono(11)).em(0.02, 11).foregroundColor(p.inkSoft)
                HStack(spacing: 12) {
                    Text("ПРОСМ. \(e.viewers.int ?? 0)")
                    Text("ИДУТ \(e.going.int ?? 0)").bold().foregroundColor(p.ink)
                    Text("ДУМАЮТ \(e.interested.int ?? 0)")
                }
                .font(AppFont.mono(11)).em(0.02, 11).foregroundColor(p.inkSoft)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Photo(url: e.image_url.string, height: 64, seed: Int(e["id"].id) + 3).frame(width: 64)
        }
        .contentShape(Rectangle())
    }
}

/// Статистика одного ивента для организатора: цифры, динамика за 14 дней, кто идёт.
struct EventStatsView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    let id: Int64

    @State private var d: JSON?
    @State private var notFound = false

    var body: some View {
        if notFound {
            Screen { BackHeader("Мои ивенты") } content: { EmptyState(title: "Статистика недоступна", text: "Её видит только организатор ивента.") }
        } else if let d {
            content(d)
        } else {
            LoadingScreen("Считаем статистику…") { BackHeader("Мои ивенты") }.task { await load() }
        }
    }

    @ViewBuilder
    private func content(_ d: JSON) -> some View {
        let viewers = d.viewers.num
        let going = d.going.num
        let conv = viewers > 0 ? min(100, going / viewers * 100) : 0
        Screen(spacing: 20, onRefresh: load) {
            BackHeader("Мои ивенты")
        } content: {
            VStack(alignment: .leading, spacing: 8) {
                Meta("Статистика · ивент № \(Fmt.pad(id, 4))")
                Text(d.title.str.uppercased()).font(AppFont.display(26)).em(-0.02, 26).foregroundColor(p.ink).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 10) {
                    Text(d.start_at.date.map { "\(Fmt.weekday($0)) \(Fmt.ddmm($0)) \(Fmt.hhmm($0))" } ?? "—")
                    Text((MyEventStatRow.statusLabel[d.status.str] ?? d.status.str).uppercased()).bold()
                        .foregroundColor(d.status.str == "rejected" ? p.accent : p.ink)
                }
                .font(AppFont.mono(12)).em(0.02, 12).foregroundColor(p.inkSoft)
            }
            if d.status.str == "rejected", let reason = d.rejection_reason.string, !reason.isEmpty {
                AlertBlock(title: "Причина отклонения", text: reason)
            }
            Rule2()
            HStack(alignment: .top, spacing: 16) {
                StatCell(value: Fmt.num(viewers), label: "Просмотров")
                VRule().frame(height: 44)
                StatCell(value: Fmt.num(going), label: "Идут", accent: true)
                VRule().frame(height: 44)
                StatCell(value: Fmt.num(d.interested.num), label: "Думают")
            }
            VStack(spacing: 10) {
                Leader(label: "Конверсия в «Пойду»", value: viewers > 0 ? "\(Fmt.num(conv))%" : "—")
                Leader(label: "Новых «Пойду» за неделю", value: "+\(d.going_7d.int ?? 0)")
                if d.price.num > 0 || (d.tickets.int ?? 0) > 0 {
                    Leader(label: "Билетов продано", value: "\(d.tickets.int ?? 0)")
                    Leader(label: "Выручка", value: Fmt.rub(d.revenue.num), valueBold: true)
                }
            }
            Rule2()
            SectionLabel("Последние 14 дней")
            DaysChart(days: d.days.array)
            Rule2()
            let people = d.attendees.array
            HStack {
                SectionLabel("Кто придёт")
                Spacer()
                Meta("\(people.count)")
            }
            if people.isEmpty {
                Text("Пока никто не отметился. Поделитесь ивентом с друзьями — ссылка на странице ивента.")
                    .font(AppFont.text(14)).foregroundColor(p.inkSoft)
            }
            VStack(spacing: 14) {
                ForEach(Array(people.enumerated()), id: \.offset) { _, a in
                    PersonRow(user: a, meta: [a.username.string.map { "@\($0)" }, a.university.string].compactMap { $0 }.joined(separator: " · ")) {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(a.status.str == "going" ? "ИДЁТ" : "ДУМАЕТ").font(AppFont.mono(11, .bold))
                                .foregroundColor(a.status.str == "going" ? p.ink : p.inkSoft)
                            if a.paid.bool { Text("✓ БИЛЕТ").font(AppFont.mono(10, .bold)).foregroundColor(p.accent) }
                        }
                    }
                }
            }
            Rule()
            Button("Открыть страницу ивента →") { session.push(.event(id)) }.buttonStyle(.bracket).frame(maxWidth: .infinity)
        }
    }

    private func load() async {
        do {
            d = try await API.shared.get("events/\(id)/stats")
        } catch is CancellationError {
        } catch {
            if d == nil { notFound = true }
        }
    }
}

/// Столбики по дням: светлые — просмотры, тёмные — новые «Пойду».
private struct DaysChart: View {
    @Environment(\.palette) private var p
    let days: [JSON]

    var body: some View {
        let maxV = max(1, days.map { max($0.viewers.num, $0.going.num) }.max() ?? 1)
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(Array(days.enumerated()), id: \.offset) { _, d in
                    ZStack(alignment: .bottom) {
                        Rectangle().fill(p.inkFaint.opacity(0.45)).frame(height: max(2, 90 * d.viewers.num / maxV))
                        Rectangle().fill(p.accent).frame(height: d.going.num > 0 ? max(3, 90 * d.going.num / maxV) : 0)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 90, alignment: .bottom)
            HStack {
                Text(label(days.first)).frame(maxWidth: .infinity, alignment: .leading)
                Text(label(days.last)).frame(maxWidth: .infinity, alignment: .trailing)
            }
            .font(AppFont.mono(10)).foregroundColor(p.inkSoft)
            HStack(spacing: 14) {
                legend(p.inkFaint.opacity(0.45), "Просмотры")
                legend(p.accent, "Новые «Пойду»")
            }
        }
    }

    private func label(_ d: JSON?) -> String {
        guard let s = d?.day.string else { return "" }
        let parts = s.split(separator: "-")
        return parts.count == 3 ? "\(parts[2]).\(parts[1])" : s
    }

    private func legend(_ c: Color, _ t: String) -> some View {
        HStack(spacing: 6) {
            Rectangle().fill(c).frame(width: 10, height: 10)
            Text(t.uppercased()).font(AppFont.mono(10)).em(0.04, 10).foregroundColor(p.inkSoft)
        }
    }
}
