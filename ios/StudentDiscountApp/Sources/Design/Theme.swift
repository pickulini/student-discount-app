import SwiftUI

/// Единая дизайн-система приложения: тёмный, редакторский, urban discovery —
/// НЕ маркетплейс. 95% оттенков серого / 5% акцентного лайма.
enum Theme {

    enum Colors {
        static let background = Color(hex: "121316")
        static let surface = Color(hex: "1B1C1F")
        static let surfaceSecondary = Color(hex: "222327")

        static let textPrimary = Color(hex: "F2F2F2")
        static let textSecondary = Color(hex: "8A8A8A")
        static let textMuted = Color(hex: "5C5C5C")

        static let divider = Color(hex: "292929")

        /// Лаймовый акцент — используется точечно: CTA, ключевые цифры,
        /// активные состояния. Никогда не заливать весь интерфейс.
        static let accent = Color(hex: "D7FF3F")
    }

    enum Spacing {
        static let xs: CGFloat = 4
        static let s: CGFloat = 8
        static let m: CGFloat = 12
        static let l: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        static let xxxl: CGFloat = 32
    }

    /// Более угловатая версия: прямые линии — часть визуального языка,
    /// скругления используются минимально, только чтобы снять остроту углов.
    enum Radius {
        static let small: CGFloat = 4
        static let medium: CGFloat = 6
        static let hero: CGFloat = 10
    }

    /// Фиксированные размеры, которые не должны "плавать" от исходной
    /// фотографии — иначе карточки в ленте получают разную высоту и
    /// заезжают друг на друга.
    enum Sizing {
        static let cardImageHeight: CGFloat = 168
        static let heroImageHeight: CGFloat = 260
    }

    enum Typography {
        static let largeTitle = Font.system(size: 30, weight: .semibold, design: .default)
        static let title = Font.system(size: 22, weight: .semibold, design: .default)
        static let headline = Font.system(size: 17, weight: .medium, design: .default)
        static let body = Font.system(size: 15, weight: .regular, design: .default)
        static let caption = Font.system(size: 13, weight: .regular, design: .default)
        /// Мелкий технический/uppercase-лейбл — «КОФЕЙНЯ · 450 М», категории.
        static let label = Font.system(size: 11, weight: .semibold, design: .default)
            .smallCaps()
        /// Крупная цифра — процент скидки, дата события.
        static let metric = Font.system(size: 26, weight: .bold, design: .rounded)
    }
}

extension Color {
    init(hex: String) {
        var hexString = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexString = hexString.replacingOccurrences(of: "#", with: "")
        var value: UInt64 = 0
        Scanner(string: hexString).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

/// Единая тёмная схема — это не «поддержка тёмной темы», а осознанная
/// визуальная идентичность продукта, поэтому применяется принудительно.
struct ThemedBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .preferredColorScheme(.dark)
            .tint(Theme.Colors.accent)
    }
}

extension View {
    func themed() -> some View { modifier(ThemedBackground()) }
}
