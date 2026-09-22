import SwiftUI

/// Общий компонент фото места/предложения — переиспользуется в карточках
/// ленты, деталях и профиле. Фотография — ключевой элемент editorial-стиля,
/// поэтому плейсхолдер тоже выдержан в тёмной палитре, без иконки корзины.
///
/// Источники фото приходят с очень разными пропорциями и разрешениями,
/// поэтому размер этого view ЦЕЛИКОМ определяется рамкой, которую даёт
/// вызывающий код (через `.frame(height:)`/`.frame(width:height:)`), а не
/// исходным изображением — иначе карточки в ленте получают разную высоту
/// и "заезжают" друг на друга. `GeometryReader` заставляет фото всегда
/// точно заполнять уже заданную рамку, без исключений.
struct OfferImageView: View {
    let offer: Offer

    var body: some View {
        GeometryReader { proxy in
            Group {
                if let url = offer.absoluteImageURL(base: AppConfig.baseURL) {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image {
                            image
                                .resizable()
                                .scaledToFill()
                                .frame(width: proxy.size.width, height: proxy.size.height)
                        } else {
                            placeholder
                        }
                    }
                } else {
                    placeholder
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
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
