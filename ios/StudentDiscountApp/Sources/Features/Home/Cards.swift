import SwiftUI

/// Крупная карточка предложения (макет 01): фото 210, №, название, скидка, три строки, срок и «[ Взять ]».
struct OfferCard: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    let offer: JSON
    var index = 0
    var distance: Double? = nil

    var body: some View {
        let tags = offer.tags.array.map { $0.name.str }
        let meta = (Array(tags.prefix(2)) + [distance.map(LocationProvider.format)].compactMap { $0 }).joined(separator: " · ")
        let base = offer.base_price.num
        let until = offer.end_at.date.map { "ДО \(Fmt.ddmmyy($0))" } ?? "БЕЗ СРОКА"

        VStack(alignment: .leading, spacing: 12) {
            Button { session.push(.offer(offer["id"].id)) } label: {
                Photo(url: offer.image_url.string, height: 210, seed: Int(offer["id"].id), caption: tags.first)
            }
            .buttonStyle(.plain)
            HStack(alignment: .top, spacing: 10) {
                Text("№" + String(format: "%02d", index + 1)).font(AppFont.mono(12)).em(0.02, 12).foregroundColor(p.inkFaint).padding(.top, 3)
                Button { session.push(.offer(offer["id"].id)) } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text((offer.company_name.string ?? offer.title.str).uppercased())
                            .font(AppFont.display(18)).em(-0.01, 18).foregroundColor(p.ink).multilineTextAlignment(.leading)
                        if !meta.isEmpty { Text(meta).font(AppFont.text(13)).foregroundColor(p.inkSoft).lineLimit(1) }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                if offer.discount_value.num > 0 {
                    Text(OfferMath.discountLabel(offer)).font(AppFont.display(20)).foregroundColor(p.accent).lineLimit(1).fixedSize()
                }
            }
            VStack(spacing: 8) {
                Leader(label: "Цена", value: base > 0 ? Fmt.rub(base) : "—")
                Leader(label: "Студентам", value: offer.discount_value.num > 0 ? OfferMath.discountLabel(offer) : "—", valueBold: true)
                Leader(label: "Ваша цена", value: base > 0 ? Fmt.rub(OfferMath.price(offer)) : "—", strong: true)
            }
            .padding(.top, 2)
            HStack {
                Text(until).font(AppFont.mono(11)).em(0.04, 11).foregroundColor(p.inkSoft)
                Spacer()
                Button("Взять") { session.push(.checkout(offer["id"].id, sbp: false)) }.buttonStyle(.bracket)
            }
        }
    }
}

/// Мини-карточка ленты «Популярное»: 150 px, фото 110.
struct MiniOfferCard: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    let offer: JSON
    var distance: Double? = nil
    var body: some View {
        Button { session.push(.offer(offer["id"].id)) } label: {
            VStack(alignment: .leading, spacing: 8) {
                Photo(url: offer.image_url.string, height: 110, seed: Int(offer["id"].id)).frame(width: 150)
                Text((offer.company_name.string ?? offer.title.str).uppercased())
                    .font(AppFont.display(12, medium: true)).foregroundColor(p.ink).lineLimit(1)
                HStack(spacing: 8) {
                    if offer.discount_value.num > 0 {
                        Text(OfferMath.discountLabel(offer)).font(AppFont.mono(11, .bold)).foregroundColor(p.accent)
                    }
                    if let distance { Text(LocationProvider.format(distance)).font(AppFont.mono(11)).foregroundColor(p.inkSoft) }
                }
            }
            .frame(width: 150, alignment: .leading)
        }
        .buttonStyle(.plain)
    }
}

/// Карточка ивента на главной: фото 180, число и месяц, название, «вход студентам», «идут · [ Пойду ]».
struct EventCard: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    let event: JSON

    var body: some View {
        let d = event.start_at.date ?? Date()
        let price = event.special_price.num
        let c = Calendar.current
        VStack(alignment: .leading, spacing: 12) {
            Button { session.push(.event(event["id"].id)) } label: {
                Photo(url: event.image_url.string, height: 180, seed: Int(event["id"].id) + 3, caption: event.tags[0].name.string)
            }
            .buttonStyle(.plain)
            Button { session.push(.event(event["id"].id)) } label: {
                HStack(alignment: .top, spacing: 14) {
                    VStack(spacing: 2) {
                        Text("\(c.component(.day, from: d))").font(AppFont.display(26)).foregroundColor(p.ink)
                        Text(Fmt.monthsShort[c.component(.month, from: d) - 1]).font(AppFont.mono(10, .medium)).em(0.08, 10).foregroundColor(p.inkSoft)
                    }
                    VRule()
                    VStack(alignment: .leading, spacing: 4) {
                        Text(event.title.str.uppercased()).font(AppFont.display(16)).em(-0.01, 16).foregroundColor(p.ink).multilineTextAlignment(.leading)
                        Text(Fmt.hhmm(d) + (event.address.string.map { " · \($0)" } ?? ""))
                            .font(AppFont.text(13)).foregroundColor(p.inkSoft).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
                .fixedSize(horizontal: false, vertical: true)
            }
            .buttonStyle(.plain)
            Leader(label: "Вход студентам", value: price > 0 ? Fmt.rub(price) : "Бесплатно", valueColor: price > 0 ? p.ink : p.accent, valueBold: true)
            HStack {
                Text("ИДУТ \(event.attendees_count.int ?? 0)").font(AppFont.mono(11)).em(0.04, 11).foregroundColor(p.inkSoft)
                Spacer()
                Button("Пойду") { session.push(.event(event["id"].id)) }.buttonStyle(.bracket)
            }
        }
    }
}
