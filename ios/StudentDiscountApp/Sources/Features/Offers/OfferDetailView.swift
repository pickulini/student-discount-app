import SwiftUI

/// Предложение (макет 02): фото, описание, расчёт, информация, мини-карта, оплата.
struct OfferDetailView: View {
    @Environment(\.palette) private var p
    @Environment(\.openURL) private var openURL
    @EnvironmentObject private var session: Session
    @StateObject private var geo = LocationProvider.shared
    let id: Int64

    @State private var data: JSON?
    @State private var notFound = false
    @State private var wallet: JSON = .null
    @State private var subscribed = false
    @State private var subBusy = false
    @State private var photo = 0

    var body: some View {
        if notFound {
            Screen { BackHeader() } content: { EmptyState(title: "Предложение не найдено") }
        } else if let data {
            content(data)
        } else {
            LoadingScreen("Загрузка предложения…") { BackHeader() }.task { await load() }
        }
    }

    @ViewBuilder
    private func content(_ d: JSON) -> some View {
        let offer = d.offer
        let name = offer.company_name.string ?? offer.title.str
        let photos = ([offer.image_url.string] + offer.gallery.array.map { $0.string }).compactMap { $0 }.filter { !$0.isEmpty }
        let active = offer.status.str == "published" && (offer.end_at.date ?? .distantFuture) > Date()
        let base = offer.base_price.num
        let student = OfferMath.price(offer)
        let maxBonus = offer.bonus_allowed.bool ? (student * offer.max_bonus_percent.num / 100).rounded(.down) : 0
        let bonus = min(maxBonus, wallet.bonus.num.rounded(.down))
        let total = max(0, student - bonus)
        let save = base - total

        Screen(spacing: 20) {
            BackHeader {
                if offer.company_id.int64 != nil {
                    Button(subscribed ? "✓ Подписаны" : "+ Подписаться") { Task { await toggleSubscribe(offer) } }
                        .buttonStyle(.bracket(11)).disabled(subBusy)
                }
            }
        } content: {
            Photo(url: photos.indices.contains(photo) ? photos[photo] : nil, height: 300, seed: Int(id),
                  caption: offer.address.string.map { "\(name) · \($0)" })
            if photos.count > 1 {
                HStack(spacing: 8) {
                    ForEach(Array(photos.prefix(4).enumerated()), id: \.offset) { i, u in
                        Button { photo = i } label: {
                            Photo(url: u, height: 60, seed: i)
                                .overlay(Rectangle().stroke(i == photo ? p.ink : Color.clear, lineWidth: 1).padding(-3))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, -8)
            }
            HStack {
                Meta("Предложение № \(Fmt.pad(offer["id"].id))")
                Spacer()
                Text(active ? "АКТИВНО" : "ЗАВЕРШЕНО").font(AppFont.mono(11, .bold)).em(0.06, 11).foregroundColor(active ? p.ink : p.inkSoft)
            }
            VStack(alignment: .leading, spacing: 12) {
                Text(name.uppercased()).font(AppFont.display(30)).em(-0.02, 30).foregroundColor(p.ink).fixedSize(horizontal: false, vertical: true)
                Text(offer.title.str + (offer.description.string.map { ". \($0)" } ?? ""))
                    .font(AppFont.text(15)).lineSpacing(5).foregroundColor(p.inkSoft)
                if !offer.tags.array.isEmpty {
                    Text(offer.tags.array.map { "#" + $0.name.str.uppercased() }.joined(separator: "   "))
                        .font(AppFont.mono(11)).em(0.06, 11).foregroundColor(p.inkSoft)
                }
            }
            Rule2()
            VStack(spacing: 10) {
                Leader(label: "Цена", value: Fmt.rub(base))
                Leader(label: "Скидка студента", value: OfferMath.discountLabel(offer), valueColor: p.accent, valueBold: true)
                if offer.bonus_allowed.bool && maxBonus > 0 {
                    Leader(label: "Бонусы (до \(Fmt.num(offer.max_bonus_percent.num))%)", value: "−\(Fmt.num(bonus)) ₽")
                }
            }
            Rule()
            VStack(spacing: 10) {
                HStack(alignment: .lastTextBaseline, spacing: 8) {
                    Text("ИТОГО К ОПЛАТЕ").font(AppFont.mono(12, .bold)).em(0.03, 12).foregroundColor(p.ink).fixedSize()
                    DashLine().stroke(p.inkFaint, style: StrokeStyle(lineWidth: 1, dash: [3, 3])).frame(height: 1)
                    Text(Fmt.rub(total)).font(AppFont.display(30)).foregroundColor(p.ink).fixedSize()
                }
                if save > 0 { Leader(label: "Вы экономите", value: Fmt.rub(save), valueColor: p.inkSoft, labelColor: p.inkSoft) }
            }
            Rule2()
            VStack(spacing: 10) {
                if let addr = offer.address.string, !addr.isEmpty {
                    Button { openMap(offer) } label: { Leader(label: "Адрес", value: "\(addr) →") }.buttonStyle(.plain)
                }
                if let h = offer.working_hours.string, !h.isEmpty { Leader(label: "Часы", value: h) }
                if let ph = offer.phone.string, !ph.isEmpty {
                    Button {
                        if let u = URL(string: "tel:" + ph.filter { "+0123456789".contains($0) }) { openURL(u) }
                    } label: { Leader(label: "Телефон", value: ph) }.buttonStyle(.plain)
                }
                Leader(label: "Действует до", value: Fmt.ddmmyy(offer.end_at.date))
            }
            if offer.address.string != nil || offer.latitude.double != nil {
                Button { openMap(offer) } label: { MiniMap(label: mapLabel(offer)) }.buttonStyle(.plain)
            }
            Rule()
            Button(active ? "Оплатить \(Fmt.rub(total)) · СБП" : "Предложение завершено") {
                session.push(.checkout(id, sbp: true))
            }
            .buttonStyle(.primary).disabled(!active)
            HStack {
                Button("С кошелька") { session.push(.checkout(id, sbp: false)) }.buttonStyle(.bracket).disabled(!active)
                Spacer()
                ShareLink(item: URL(string: "\(AppConfig.server)/offers/\(id)")!, subject: Text(name)) {
                    Text("[ ПОДЕЛИТЬСЯ ]").font(AppFont.mono(12, .medium)).em(0.04, 12).foregroundColor(p.ink)
                }
            }
        }
    }

    private func mapLabel(_ offer: JSON) -> String {
        if let d = geo.distance(to: offer) {
            return "Вы · \(LocationProvider.format(d)) · \(max(1, Int(d / 80))) мин пешком"
        }
        return (offer.address.string.map { "\($0) · " } ?? "") + "открыть карту"
    }

    private func openMap(_ offer: JSON) {
        var url: URL?
        if let lat = offer.latitude.double, let lng = offer.longitude.double, lat != 0 {
            if let me = geo.location?.coordinate {
                url = URL(string: "https://yandex.ru/maps/?rtext=\(me.latitude),\(me.longitude)~\(lat),\(lng)&rtt=pd")
            } else {
                url = URL(string: "https://yandex.ru/maps/?pt=\(lng),\(lat)&z=16&l=map")
            }
        } else if let a = offer.address.string?.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            url = URL(string: "https://yandex.ru/maps/?text=\(a)")
        }
        if let url { openURL(url) }
    }

    private func load() async {
        do {
            let d = try await API.shared.get("offers/\(id)")
            data = d
            if let cid = d.offer.company_id.int64,
               let ids = try? await API.shared.get("subscriptions/companies/ids") {
                subscribed = ids.array.contains { $0.int64 == cid }
            }
        } catch {
            notFound = true
        }
        wallet = (try? await API.shared.get("wallet")) ?? .null
    }

    private func toggleSubscribe(_ offer: JSON) async {
        guard let cid = offer.company_id.int64 else { return }
        subBusy = true
        defer { subBusy = false }
        do {
            if subscribed { try await API.shared.delete("companies/\(cid)/subscribe") } else { try await API.shared.post("companies/\(cid)/subscribe") }
            subscribed.toggle()
        } catch {}
    }
}

/// Мини-карта: пунктирный маршрут от «вы» до места.
struct MiniMap: View {
    @Environment(\.palette) private var p
    @Environment(\.colorScheme) private var scheme
    let label: String
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            (scheme == .dark ? p.surface2 : p.desk)
            GeometryReader { g in
                let w = g.size.width, h = g.size.height
                Path { path in
                    path.move(to: CGPoint(x: w * 0.08, y: h * 0.75))
                    path.addCurve(to: CGPoint(x: w * 0.55, y: h * 0.45), control1: CGPoint(x: w * 0.25, y: h * 0.72), control2: CGPoint(x: w * 0.4, y: h * 0.45))
                    path.addCurve(to: CGPoint(x: w * 0.97, y: h * 0.2), control1: CGPoint(x: w * 0.7, y: h * 0.45), control2: CGPoint(x: w * 0.85, y: h * 0.25))
                }
                .stroke(p.ink, style: StrokeStyle(lineWidth: 1.2, dash: [4, 4]))
                Circle().fill(p.ink).frame(width: 8, height: 8).position(x: w * 0.08, y: h * 0.75)
                Circle().fill(p.accent).frame(width: 14, height: 14).position(x: w * 0.97, y: h * 0.2)
            }
            Text(label.uppercased()).font(AppFont.mono(10)).em(0.04, 10).foregroundColor(p.inkSoft)
                .padding(.leading, 28).padding(.bottom, 10).lineLimit(1)
        }
        .frame(height: 120)
        .clipped()
    }
}
