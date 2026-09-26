import SwiftUI

/// Ивент (макет 31): обложка, описание, детали, друзья, «Пойду / Может быть».
struct EventDetailView: View {
    @Environment(\.palette) private var p
    @Environment(\.openURL) private var openURL
    @EnvironmentObject private var session: Session
    let id: Int64

    @State private var event: JSON?
    @State private var meta: JSON = .null
    @State private var friends: [JSON] = []
    @State private var notFound = false
    @State private var busy = ""
    @State private var error: (String, String, Bool)?

    var body: some View {
        if notFound {
            Screen { BackHeader("Ивенты") } content: { EmptyState(title: "Ивент не найден или скрыт") }
        } else if let event {
            content(event)
        } else {
            LoadingScreen("Загружаем ивент…") { BackHeader("Ивенты") }.task { await load() }
        }
    }

    @ViewBuilder
    private func content(_ e: JSON) -> some View {
        let occ = EventsCore.next(e)
        let price = EventsCore.price(e, meta)
        let status = meta.my_status.string ?? e.my_attendee_status.str
        let going = status == "going"
        let interested = status == "interested"
        let rec = EventsCore.recurrenceLabel(e)
        let caption = [meta.company_name.string, e.address.string].compactMap { $0 }.joined(separator: " · ")
        let published = e.status.str == "published"
        let isOwner = e.organizer_id.int64 == session.user["id"].int64
        let organizer = meta.company_name.string ?? meta.organizer.full_name.string ?? ""
        let sameDay = Calendar.current.isDate(occ.start, inSameDayAs: occ.end)
        let endLabel = sameDay ? Fmt.hhmm(occ.end) : "\(Fmt.weekday(occ.end)) \(Fmt.ddmm(occ.end)) · \(Fmt.hhmm(occ.end))"
        let friendsGoing = friends.filter { ["going", "interested"].contains($0.status.str) }
        let names = friendsGoing.map { $0.user.full_name.str.split(separator: " ").first.map(String.init) ?? "" }.filter { !$0.isEmpty }
        let friendsLine = names.count > 2 ? "\(names.prefix(2).joined(separator: ", ")) и ещё \(names.count - 2)" : names.joined(separator: " и ")

        Screen(spacing: 20, onRefresh: load) {
            BackHeader("Ивенты") {
                ShareLink(item: URL(string: "\(AppConfig.server)/events/\(id)")!) {
                    Text("[ ПОДЕЛИТЬСЯ ]").font(AppFont.mono(11, .medium)).em(0.04, 11).foregroundColor(p.ink)
                }
            }
        } content: {
            Photo(url: e.image_url.string, height: 240, seed: Int(id) + 3, caption: caption)
            HStack {
                Meta("Ивент № \(Fmt.pad(id, 4))")
                Spacer()
                if !rec.isEmpty { Text(rec.uppercased()).font(AppFont.mono(11, .bold)).em(0.04, 11).foregroundColor(p.ink) }
            }
            Text(e.title.str.uppercased()).font(AppFont.display(30)).em(-0.02, 30).foregroundColor(p.ink).fixedSize(horizontal: false, vertical: true)
            if let d = e.description.string, !d.isEmpty {
                Text(d).font(AppFont.text(15)).lineSpacing(5).foregroundColor(p.inkSoft)
            }
            if !published {
                AlertBlock(title: e.status.str == "pending_review" ? "На модерации" : e.status.str == "draft" ? "Черновик" : "Не опубликован",
                           text: e.status.str == "pending_review" ? "Ивент появится в ленте после проверки модератором." : "Ивент пока видите только вы.")
            }
            Rule2()
            VStack(spacing: 10) {
                Leader(label: "Начало", value: "\(Fmt.weekday(occ.start)) \(Fmt.ddmm(occ.start)) · \(Fmt.hhmm(occ.start))")
                Leader(label: "Окончание", value: endLabel)
                if let a = e.address.string, !a.isEmpty {
                    Button {
                        if let q = a.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed), let u = URL(string: "https://yandex.ru/maps/?text=\(q)") { openURL(u) }
                    } label: { Leader(label: "Место", value: "\(a) →") }.buttonStyle(.plain)
                }
                if !organizer.isEmpty { Leader(label: "Организатор", value: organizer) }
                if let maxUses = meta.max_uses.int, maxUses > 0 {
                    Leader(label: "Мест", value: "\(e.attendees_count.int ?? 0) / \(maxUses)")
                } else {
                    Leader(label: "Идут", value: "\(e.attendees_count.int ?? 0)")
                }
                Leader(label: "Вход студентам", value: price > 0 ? Fmt.rub(price) : "БЕСПЛАТНО", valueColor: price > 0 ? p.ink : p.accent, valueBold: true)
            }
            Rule2()
            if !friendsGoing.isEmpty {
                HStack(spacing: 16) {
                    HStack(spacing: -10) {
                        ForEach(Array(friendsGoing.prefix(3).enumerated()), id: \.offset) { _, f in
                            Avatar(url: f.user.avatar_url.string, name: f.user.full_name.str, size: 34)
                                .overlay(Circle().stroke(p.bg, lineWidth: 2))
                        }
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("ИДУТ ДРУЗЬЯ").font(AppFont.mono(11, .bold)).em(0.06, 11).foregroundColor(p.ink)
                        Text(friendsLine).font(AppFont.text(13)).foregroundColor(p.inkSoft).lineLimit(1)
                    }
                }
            }
            if published && !isOwner {
                HStack(spacing: 12) {
                    if going {
                        Button("✓ Вы идёте") {}.buttonStyle(.primary).allowsHitTesting(false)
                    } else {
                        Button(busy == "go" ? "…" : price > 0 ? "Билет · \(Fmt.rub(price))" : "✓ Пойду") { run("go") { try await EventsCore.go(id) } }
                            .buttonStyle(.primary).disabled(!busy.isEmpty)
                    }
                    if going {
                        if price > 0 {
                            Button("Мой билет") { session.push(.orders) }.buttonStyle(.outline)
                        } else {
                            Button(busy == "leave" ? "…" : "Не пойду") { run("leave") { try await API.shared.delete("events/\(id)/schedule") } }
                                .buttonStyle(.outline).disabled(!busy.isEmpty)
                        }
                    } else {
                        Button(busy == "maybe" ? "…" : interested ? "✓ Может быть" : "Может быть") {
                            run("maybe") { try await API.shared.post("events/\(id)/rsvp", ["status": interested ? "none" : "interested"]) }
                        }
                        .buttonStyle(.outline).disabled(!busy.isEmpty)
                    }
                }
                if let error {
                    AlertBlock(title: error.0, text: error.1)
                    if error.2 { Button("В кошелёк") { session.open(.wallet) }.buttonStyle(.bracket) }
                }
                Text((price > 0 && !going ? "Оплата с кошелька. " : "") + "Напомним за 2 часа до начала.")
                    .font(AppFont.text(12)).foregroundColor(p.inkSoft).frame(maxWidth: .infinity)
            }
            if isOwner {
                Button("Статистика ивента →") { session.push(.eventStats(id)) }.buttonStyle(.primary)
                Text("Это ваш ивент: просмотры, кто идёт и продажи — в статистике.").font(AppFont.text(13)).foregroundColor(p.inkSoft)
            }
        }
    }

    private func run(_ key: String, _ fn: @escaping () async throws -> Void) {
        Task {
            busy = key
            error = nil
            defer { busy = "" }
            do {
                try await fn()
                await load()
            } catch {
                let msg = error.localizedDescription
                if msg.contains("Недостаточно") {
                    self.error = ("Недостаточно средств", "Пополните кошелёк и попробуйте ещё раз.", true)
                } else {
                    self.error = ("Не получилось", msg, false)
                }
            }
        }
    }

    private func load() async {
        do {
            event = try await API.shared.get("events/\(id)")
        } catch {
            notFound = event == nil
            return
        }
        meta = (await EventsCore.meta([id]))[String(id)] ?? .null
        friends = (try? await API.shared.get("events/friends", ["event_id": String(id)]))?.array ?? []
    }
}
