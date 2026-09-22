import SwiftUI

/// Общий компонент фото места/предложения — переиспользуется в карточках
/// ленты, деталях и профиле. Фотография — ключевой элемент editorial-стиля,
/// поэтому плейсхолдер тоже выдержан в тёмной палитре, без иконки корзины.
struct OfferImageView: View {
    let offer: Offer

    var body: some View {
        Group {
            if let url = offer.absoluteImageURL(base: AppConfig.baseURL) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .clipped()
    }

    private var placeholder: some View {
        ZStack {
            Theme.Colors.surface
            DottedDivider(color: Theme.Colors.divider, dotSize: 2, spacing: 8)
                .frame(width: 60)
        }
    }
}
