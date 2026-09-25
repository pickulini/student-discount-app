import SwiftUI
import UIKit

/*
 * «Студент−%» — визуальный язык кассового чека (Figma «Концепция «Чек»»).
 * Белая бумага, чёрная краска, никаких рамок, теней и скруглений:
 * структуру держат пунктир, двойная черта и строки с отточием.
 * Красный — «вторая краска принтера», 1–2 места на экран.
 *
 * Тёмная тема — «B · тёплая тьма»: тёплый почти-чёрный фон, кремовые текст
 * и линии. Чек заказа в тёмной теме остаётся бумажным (Palette.paper).
 */

// MARK: - Палитра

struct Palette {
    let bg: Color
    let surface2: Color
    let ink: Color
    let inkSoft: Color
    let inkFaint: Color
    let line: Color
    let accent: Color
    let onInk: Color
    let desk: Color
    let plateSoft: Color
    let accentInk: Color

    static let light = Palette(
        bg: Color(hex: 0xFFFFFF), surface2: Color(hex: 0xF4F4F4),
        ink: Color(hex: 0x121212), inkSoft: Color(hex: 0x6B6B6B), inkFaint: Color(hex: 0xA8A8A8),
        line: Color(hex: 0xBDBDBD), accent: Color(hex: 0xD12B1F), onInk: Color(hex: 0xFFFFFF),
        desk: Color(hex: 0xEDEDEA), plateSoft: Color(hex: 0xCFCFCF), accentInk: Color(hex: 0xFFFFFF))

    static let dark = Palette(
        bg: Color(hex: 0x17140F), surface2: Color(hex: 0x221D16),
        ink: Color(hex: 0xECE1C8), inkSoft: Color(hex: 0xA69679), inkFaint: Color(hex: 0x6F6452),
        line: Color(hex: 0x4B4335), accent: Color(hex: 0xF2674F), onInk: Color(hex: 0x17140F),
        desk: Color(hex: 0x0E0C09), plateSoft: Color(hex: 0x4B4335), accentInk: Color(hex: 0x17140F))

    /// Бумага чека в тёмной теме.
    static let paperDark = Palette(
        bg: Color(hex: 0xE2D5B7), surface2: Color(hex: 0xD6C8A7),
        ink: Color(hex: 0x2B2118), inkSoft: Color(hex: 0x6E5F4A), inkFaint: Color(hex: 0x9F8E72),
        line: Color(hex: 0xB3A284), accent: Color(hex: 0xB53222), onInk: Color(hex: 0xE2D5B7),
        desk: Color(hex: 0x0E0C09), plateSoft: Color(hex: 0xB3A284), accentInk: Color(hex: 0xE2D5B7))
}

private struct PaletteKey: EnvironmentKey {
    static let defaultValue = Palette.light
}

extension EnvironmentValues {
    var palette: Palette {
        get { self[PaletteKey.self] }
        set { self[PaletteKey.self] = newValue }
    }
}

/// Ставит палитру по текущей схеме (светлая/тёмная) для всего поддерева.
struct ThemedRoot: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    func body(content: Content) -> some View {
        let p = scheme == .dark ? Palette.dark : Palette.light
        content
            .environment(\.palette, p)
            .tint(p.ink)
            .background(p.bg.ignoresSafeArea())
    }
}

/// Бумажный чек: в тёмной теме — своя «бумажная» палитра, в светлой — обычная.
struct PaperPalette: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    func body(content: Content) -> some View {
        content.environment(\.palette, scheme == .dark ? Palette.paperDark : Palette.light)
    }
}

extension View {
    func themedRoot() -> some View { modifier(ThemedRoot()) }
    func paperPalette() -> some View { modifier(PaperPalette()) }
}

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: 1)
    }
}

// MARK: - Тема оформления (Авто / Светлая / Тёмная)

enum ThemePref: String, CaseIterable {
    case auto, light, dark

    var scheme: ColorScheme? {
        switch self {
        case .auto: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }

    var label: String {
        switch self {
        case .auto: return "Авто"
        case .light: return "Светлая"
        case .dark: return "Тёмная"
        }
    }
}

// MARK: - Шрифты
//
// Unbounded — заголовки и крупные суммы. JetBrains Mono — всё, что
// «напечатала касса»: метки, суммы, даты, номера. Manrope — текст, который
// пишет человек.

enum AppFont {
    static func display(_ size: CGFloat, medium: Bool = false) -> Font {
        .custom(medium ? "Unbounded-Medium" : "Unbounded-Bold", fixedSize: size)
    }

    static func mono(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        let name: String
        switch weight {
        case .bold, .heavy, .black, .semibold: name = "JetBrainsMono-Bold"
        case .medium: name = "JetBrainsMono-Medium"
        default: name = "JetBrainsMono-Regular"
        }
        return .custom(name, fixedSize: size)
    }

    static func text(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        let name: String
        switch weight {
        case .bold, .heavy, .black: name = "Manrope-Bold"
        case .semibold: name = "Manrope-SemiBold"
        case .medium: name = "Manrope-Medium"
        default: name = "Manrope-Regular"
        }
        return .custom(name, fixedSize: size)
    }
}

/// Межбуквенный интервал в em, как в макете (tracking-[0.06em] и т.п.).
extension View {
    func em(_ value: CGFloat, _ size: CGFloat) -> some View { tracking(value * size) }
}
