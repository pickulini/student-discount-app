import SwiftUI

/// Карточка места/скидки в духе city-guide, а не e-commerce:
/// крупное атмосферное фото, название, метаданные строкой,
/// скидка — акцентная, но не главная и не «BUY»-кнопка на каждом элементе.
/// Вся карточка целиком тап-абельна.
struct PlaceCard: View {
    let offer: Offer

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s) {
            ZStack(alignment: .bottomLeading) {
                OfferImageView(offer: offer)
                    .frame(height: Theme.Sizing.cardImageHeight)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.hero, style: .continuous))

                if offer.discountValue > 0 {
                    MetricBadge(text: offer.discountBadge, filled: true)
                        .padding(Theme.Spacing.m)
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(offer.title.uppercased())
                    .font(Theme.Typography.headline)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .lineLimit(1)

                Text(metaLine)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .lineLimit(1)
            }
        }
    }

    private var metaLine: String {
        [offer.placeName, offer.address].compactMap { $0 }.joined(separator: " · ")
    }
}

/// Карточка события — с акцентом на дату вместо скидки.
struct EventCard: View {
    let offer: Offer

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s) {
            ZStack(alignment: .topLeading) {
                OfferImageView(offer: offer)
                    .frame(height: Theme.Sizing.cardImageHeight)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.hero, style: .continuous))

                // Плашка с датой должна одинаково читаться и на светлом, и на
                // тёмном фото, поэтому фон непрозрачный (не полупрозрачный
                // скрим поверх фото), а не подобран "под" конкретный снимок.
                VStack(alignment: .leading, spacing: 0) {
                    Text(dayString)
                        .font(Theme.Typography.metric)
                        .foregroundStyle(Theme.Colors.accent)
                    Text(monthString.uppercased())
                        .font(Theme.Typography.label)
                        .foregroundStyle(Theme.Colors.textPrimary)
                }
                .padding(.horizontal, Theme.Spacing.m)
                .padding(.vertical, Theme.Spacing.s)
                .background(Theme.Colors.background)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.small, style: .continuous))
                .padding(Theme.Spacing.m)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(offer.title)
                    .font(Theme.Typography.headline)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .lineLimit(1)
                Text(eventMetaLine)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .lineLimit(1)
            }
        }
    }

    private var dayString: String {
        guard let date = offer.eventStartAt else { return "—" }
        return date.formatted(.dateTime.day())
    }

    private var monthString: String {
        guard let date = offer.eventStartAt else { return "" }
        return date.formatted(.dateTime.month(.abbreviated))
    }

    private var eventMetaLine: String {
        var parts: [String] = []
        if let date = offer.eventStartAt {
            parts.append(date.formatted(.dateTime.hour().minute()))
        }
        if let address = offer.address { parts.append(address) }
        return parts.joined(separator: " · ")
    }
}
