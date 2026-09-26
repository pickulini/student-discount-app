import SwiftUI
import CoreImage.CIFilterBuiltins

// MARK: - Разделители

/// Горизонтальный пунктир (1px). Как `border-dashed` на сайте.
struct DashLine: Shape {
    var vertical = false
    func path(in r: CGRect) -> Path {
        var p = Path()
        if vertical {
            p.move(to: CGPoint(x: r.midX, y: r.minY)); p.addLine(to: CGPoint(x: r.midX, y: r.maxY))
        } else {
            p.move(to: CGPoint(x: r.minX, y: r.midY)); p.addLine(to: CGPoint(x: r.maxX, y: r.midY))
        }
        return p
    }
}

private let dash = StrokeStyle(lineWidth: 1, dash: [3, 3])

/// «- - - -» — между элементами одного раздела.
struct Rule: View {
    @Environment(\.palette) private var p
    var color: Color? = nil
    var body: some View {
        DashLine().stroke(color ?? p.line, style: dash).frame(height: 1)
    }
}

/// «=====» — двойная черта между разделами и перед итогом.
struct Rule2: View {
    @Environment(\.palette) private var p
    var body: some View {
        VStack(spacing: 3) {
            DashLine().stroke(p.ink, style: dash).frame(height: 1)
            DashLine().stroke(p.ink, style: dash).frame(height: 1)
        }
        .frame(height: 5)
    }
}

struct VRule: View {
    @Environment(\.palette) private var p
    var color: Color? = nil
    var body: some View {
        DashLine(vertical: true).stroke(color ?? p.line, style: dash).frame(width: 1)
    }
}

/// Зубчатый край «отрыва»: в конце ленты или чека.
struct TearEdge: View {
    @Environment(\.palette) private var p
    var body: some View {
        GeometryReader { g in
            Path { path in
                let step: CGFloat = 12
                var x: CGFloat = 0
                path.move(to: CGPoint(x: 0, y: 5.5))
                while x < g.size.width {
                    path.addLine(to: CGPoint(x: x + step / 2, y: 0.5))
                    path.addLine(to: CGPoint(x: x + step, y: 5.5))
                    x += step
                }
            }
            .stroke(p.line, lineWidth: 1.2)
        }
        .frame(height: 6)
    }
}

/// Нижний край бумажного чека — зубцы цвета бумаги.
struct PaperTear: View {
    var color: Color
    var body: some View {
        GeometryReader { g in
            Path { path in
                let step: CGFloat = 14
                var x: CGFloat = 0
                path.move(to: CGPoint(x: 0, y: 0))
                while x < g.size.width {
                    path.addLine(to: CGPoint(x: x + step / 2, y: 7))
                    path.addLine(to: CGPoint(x: x + step, y: 0))
                    x += step
                }
                path.closeSubpath()
            }
            .fill(color)
        }
        .frame(height: 7)
    }
}

// MARK: - Текст

/// Моно-подпись раздела: «ПОПУЛЯРНОЕ РЯДОМ».
struct SectionLabel: View {
    @Environment(\.palette) private var p
    let text: String
    var color: Color? = nil
    init(_ text: String, color: Color? = nil) { self.text = text; self.color = color }
    var body: some View {
        Text(text.uppercased()).font(AppFont.mono(11, .medium)).em(0.08, 11).foregroundColor(color ?? p.ink)
    }
}

/// Второстепенная моно-подпись: «ОБНОВЛЕНО 02:04».
struct Meta: View {
    @Environment(\.palette) private var p
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text.uppercased()).font(AppFont.mono(11)).em(0.04, 11).foregroundColor(p.inkSoft)
    }
}

/// Строка с отточием: «ЦЕНА ....... 300 ₽».
struct Leader: View {
    @Environment(\.palette) private var p
    let label: String
    let value: String
    var strong = false
    var valueColor: Color? = nil
    var labelColor: Color? = nil
    var valueBold = false
    var size: CGFloat = 12

    var body: some View {
        let s = strong ? size + 1 : size
        HStack(alignment: .lastTextBaseline, spacing: 8) {
            Text(label.uppercased())
                .font(AppFont.mono(s, strong ? .bold : .regular)).em(0.03, s)
                .foregroundColor(labelColor ?? p.ink)
                .lineLimit(1)
                .layoutPriority(1)
            DashLine().stroke(p.inkFaint, style: dash).frame(height: 1).frame(minWidth: 8)
            Text(value)
                .font(AppFont.mono(s, strong || valueBold ? .bold : .regular)).em(0.01, s)
                .foregroundColor(valueColor ?? p.ink)
                .lineLimit(1)
                .layoutPriority(2)
        }
    }
}

// MARK: - Кнопки

struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.palette) private var p
    @Environment(\.isEnabled) private var enabled
    var full = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppFont.mono(12, .bold)).em(0.06, 12)
            .textCase(.uppercase)
            .foregroundColor(p.onInk)
            .padding(.horizontal, 22).padding(.vertical, 15)
            .frame(maxWidth: full ? .infinity : nil)
            .background(p.ink.opacity(configuration.isPressed ? 0.85 : 1))
            .opacity(enabled ? 1 : 0.4)
            .contentShape(Rectangle())
    }
}

struct OutlineButtonStyle: ButtonStyle {
    @Environment(\.palette) private var p
    @Environment(\.isEnabled) private var enabled
    var full = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppFont.mono(12, .bold)).em(0.06, 12)
            .textCase(.uppercase)
            .foregroundColor(p.ink)
            .padding(.horizontal, 20).padding(.vertical, 14)
            .frame(maxWidth: full ? .infinity : nil)
            .background(configuration.isPressed ? p.surface2 : Color.clear)
            .overlay(Rectangle().strokeBorder(p.ink, style: StrokeStyle(lineWidth: 1, dash: [3, 3])))
            .opacity(enabled ? 1 : 0.4)
            .contentShape(Rectangle())
    }
}

/// Кнопка-текст в скобках: «[ Взять ]».
struct BracketButtonStyle: ButtonStyle {
    @Environment(\.palette) private var p
    @Environment(\.isEnabled) private var enabled
    var size: CGFloat = 12
    var color: Color? = nil
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 0) {
            Text("[ ")
            configuration.label
            Text(" ]")
        }
        .font(AppFont.mono(size, .medium)).em(0.04, size)
        .textCase(.uppercase)
        .foregroundColor(color ?? p.ink)
        .padding(.vertical, 6)
        .opacity(configuration.isPressed ? 0.6 : enabled ? 1 : 0.4)
        .contentShape(Rectangle())
    }
}

struct SmallButtonStyle: ButtonStyle {
    @Environment(\.palette) private var p
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppFont.mono(11, .bold)).em(0.04, 11)
            .textCase(.uppercase)
            .foregroundColor(p.onInk)
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(p.ink.opacity(configuration.isPressed ? 0.85 : 1))
            .opacity(enabled ? 1 : 0.4)
    }
}

extension ButtonStyle where Self == PrimaryButtonStyle {
    static var primary: PrimaryButtonStyle { PrimaryButtonStyle() }
    static var primaryCompact: PrimaryButtonStyle { PrimaryButtonStyle(full: false) }
}

extension ButtonStyle where Self == OutlineButtonStyle {
    static var outline: OutlineButtonStyle { OutlineButtonStyle() }
}

extension ButtonStyle where Self == BracketButtonStyle {
    static var bracket: BracketButtonStyle { BracketButtonStyle() }
    static func bracket(_ size: CGFloat) -> BracketButtonStyle { BracketButtonStyle(size: size) }
}

extension ButtonStyle where Self == SmallButtonStyle {
    static var small: SmallButtonStyle { SmallButtonStyle() }
}

/// Простая текстовая моно-кнопка (для шапок: «ОТМЕНА», «ЧЕРНОВИК»).
struct MonoLink: View {
    @Environment(\.palette) private var p
    let text: String
    var bold = false
    var color: Color? = nil
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(text.uppercased()).font(AppFont.mono(11, bold ? .bold : .medium)).em(0.06, 11).foregroundColor(color ?? p.ink)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Вкладки-«чипы»

struct ChipTabs<Key: Hashable>: View {
    @Environment(\.palette) private var p
    let items: [(Key, String)]
    @Binding var value: Key
    var scroll = false

    var body: some View {
        if scroll {
            ScrollView(.horizontal, showsIndicators: false) { row.padding(.horizontal, 20) }
                .padding(.horizontal, -20)
        } else {
            row
        }
    }

    private var row: some View {
        HStack(spacing: 16) {
            ForEach(items, id: \.0) { key, label in
                let active = key == value
                Button { value = key } label: {
                    Text(label.uppercased())
                        .font(AppFont.mono(12, active ? .bold : .regular)).em(0.04, 12)
                        .foregroundColor(active ? p.onInk : p.inkSoft)
                        .padding(.horizontal, active ? 6 : 0).padding(.vertical, 2)
                        .background(active ? p.ink : Color.clear)
                        .fixedSize()
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// Сегменты «ВКЛ · ВЫКЛ», «ВСЕ · ДРУЗЬЯ · НИКТО».
struct Segmented<Key: Hashable>: View {
    @Environment(\.palette) private var p
    let items: [(Key, String)]
    @Binding var value: Key
    var body: some View {
        HStack(spacing: 2) {
            ForEach(items, id: \.0) { key, label in
                let active = key == value
                Button { value = key } label: {
                    Text(label.uppercased())
                        .font(AppFont.mono(11, active ? .bold : .regular)).em(0.04, 11)
                        .foregroundColor(active ? p.onInk : p.inkSoft)
                        .padding(.horizontal, 7).padding(.vertical, 4)
                        .background(active ? p.ink : Color.clear)
                        .fixedSize()
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Фото

/// Тёплый градиент, пока фото нет или оно грузится (как «плоскость» на сайте).
struct PhotoPlaceholder: View {
    var seed: Int = 0
    private static let sets: [[UInt32]] = [
        [0x3B2416, 0x8A5A3C, 0xD9B38C],
        [0x222F44, 0x6C8FA8, 0xE8E1D3],
        [0x1B1B1B, 0x9E2B25, 0xF4E9D8],
        [0x3A2E23, 0xA27B4F, 0xEBDCC2],
        [0x101010, 0x2B3A8C, 0xF0A1C8],
    ]
    var body: some View {
        let c = Self.sets[abs(seed) % Self.sets.count].map { Color(hex: $0) }
        LinearGradient(colors: c, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

struct Photo: View {
    let url: String?
    var height: CGFloat? = nil
    var seed: Int = 0
    var caption: String? = nil

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            PhotoPlaceholder(seed: seed)
            if url != nil {
                // Карточки и обложки — копия 1024 px по короткой стороне.
                RemoteImage(ImageLoader.url(url, points: 390))
            }
            if let caption, !caption.isEmpty {
                Text(caption.uppercased())
                    .font(AppFont.mono(10)).em(0.06, 10)
                    .foregroundColor(.white.opacity(0.85))
                    .lineLimit(1)
                    .padding(.leading, 12).padding(.bottom, 12).padding(.trailing, 12)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .clipped()
    }
}

struct Avatar: View {
    let url: String?
    let name: String
    var size: CGFloat = 40
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: 0x2A2A1F), Color(hex: 0x8C8456), Color(hex: 0xE6E0B8)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            Text(String(name.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased())
                .font(AppFont.mono(size * 0.4, .bold)).foregroundColor(.white)
            if url != nil {
                RemoteImage(ImageLoader.url(url, points: size))
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}

// MARK: - Штрихкод и QR

struct Barcode: View {
    @Environment(\.palette) private var p
    var seed: Int = 1
    var height: CGFloat = 26

    var body: some View {
        GeometryReader { g in
            Canvas { ctx, size in
                var x: CGFloat = 0
                var s = UInt32(truncatingIfNeeded: seed &* 2654435761 &+ 1)
                while x < size.width {
                    s = s &* 1103515245 &+ 12345
                    let w = CGFloat(1 + (s >> 16) % 3)
                    let gap = CGFloat(1 + (s >> 20) % 3)
                    if x + w > size.width { break }
                    ctx.fill(Path(CGRect(x: x, y: 0, width: w, height: size.height)), with: .color(p.ink))
                    x += w + gap
                }
            }
            .frame(width: g.size.width, height: height)
        }
        .frame(height: height)
    }
}

struct QRCode: View {
    @Environment(\.palette) private var p
    let text: String
    var body: some View {
        if let img = Self.make(text) {
            Image(uiImage: img).interpolation(.none).resizable().scaledToFit()
                .colorMultiply(p.ink) // модули — цветом краски, фон прозрачный
        }
    }

    static func make(_ text: String) -> UIImage? {
        let f = CIFilter.qrCodeGenerator()
        f.message = Data(text.utf8)
        f.correctionLevel = "M"
        guard let out = f.outputImage else { return nil }
        // Чёрные модули на прозрачном фоне: инвертируем и берём как маску.
        let mask = out.applyingFilter("CIColorInvert").applyingFilter("CIMaskToAlpha")
        let scaled = mask.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
        let ctx = CIContext()
        guard let cg = ctx.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

// MARK: - Поля ввода

/// Поле с подписью и пунктиром снизу (сплошная линия в фокусе или при ошибке).
struct UnderlineField: View {
    @Environment(\.palette) private var p
    let label: String
    @Binding var text: String
    var placeholder = ""
    var secure = false
    var mono = false
    var right: String? = nil
    var error: String? = nil
    var hint: String? = nil
    var keyboard: UIKeyboardType = .default
    var contentType: UITextContentType? = nil
    var autocap: TextInputAutocapitalization = .sentences
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(label.uppercased()).font(AppFont.mono(11, .medium)).em(0.06, 11)
                    .foregroundColor(error != nil ? p.accent : p.inkSoft)
                Spacer()
                if let right { Text(right).font(AppFont.mono(11)).em(0.04, 11).foregroundColor(p.inkSoft) }
            }
            Group {
                if secure {
                    SecureField("", text: $text, prompt: Text(placeholder).foregroundColor(p.inkFaint))
                } else {
                    TextField("", text: $text, prompt: Text(placeholder).foregroundColor(p.inkFaint))
                }
            }
            .font(mono ? AppFont.mono(16) : AppFont.text(16))
            .foregroundColor(p.ink)
            .keyboardType(keyboard)
            .textContentType(contentType)
            .textInputAutocapitalization(autocap)
            .autocorrectionDisabled(keyboard == .emailAddress || secure || mono)
            .focused($focused)
            .padding(.bottom, 10)
            .overlay(alignment: .bottom) {
                if focused || error != nil {
                    Rectangle().fill(error != nil ? p.accent : p.ink).frame(height: 1)
                } else {
                    Rule()
                }
            }
            if let error {
                Text(error.uppercased()).font(AppFont.mono(11, .medium)).em(0.02, 11).foregroundColor(p.accent)
            } else if let hint {
                Text(hint).font(AppFont.text(12)).foregroundColor(p.inkSoft).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

// MARK: - Плашки и состояния

/// Чёрная плашка-предупреждение (касса).
struct AlertBlock: View {
    @Environment(\.palette) private var p
    let title: String
    var text: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("! " + title.uppercased()).font(AppFont.mono(12, .bold)).em(0.04, 12).foregroundColor(p.onInk)
            if let text, !text.isEmpty {
                Text(text).font(AppFont.text(14)).foregroundColor(p.onInk.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16).padding(.vertical, 14)
        .background(p.ink)
    }
}

/// Точка — пунктир — кружок: логотип-метафора и индикатор загрузки.
struct LoadingView: View {
    @Environment(\.palette) private var p
    var label: String? = nil
    @State private var phase = 0

    var body: some View {
        VStack(spacing: 14) {
            HStack(spacing: 6) {
                ForEach(0..<5, id: \.self) { i in
                    Circle().fill(p.ink).frame(width: 6, height: 6)
                        .opacity(phase == i ? 1 : 0.25)
                }
            }
            if let label { Text(label).font(AppFont.mono(12)).foregroundColor(p.inkSoft) }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onReceive(Timer.publish(every: 0.14, on: .main, in: .common).autoconnect()) { _ in phase = (phase + 1) % 5 }
    }
}

struct EmptyState: View {
    @Environment(\.palette) private var p
    let title: String
    var text: String? = nil
    var body: some View {
        VStack(spacing: 10) {
            Rule().frame(width: 96)
            Text(title).font(AppFont.text(15, .medium)).foregroundColor(p.ink).multilineTextAlignment(.center)
            if let text { Text(text).font(AppFont.text(14)).foregroundColor(p.inkSoft).multilineTextAlignment(.center) }
            Rule().frame(width: 96)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}

struct ErrorText: View {
    @Environment(\.palette) private var p
    let text: String?
    var body: some View {
        if let text, !text.isEmpty {
            Text(text.uppercased()).font(AppFont.mono(12, .medium)).em(0.02, 12).foregroundColor(p.accent)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Строка-галочка «[×] ВСЕ ПОЛЬЗОВАТЕЛИ».
struct CheckRow: View {
    @Environment(\.palette) private var p
    let title: String
    var sub: String? = nil
    let checked: Bool
    var action: (() -> Void)? = nil
    var body: some View {
        Button { action?() } label: {
            HStack(alignment: .top, spacing: 12) {
                Text(checked ? "[×]" : "[ ]").font(AppFont.mono(13, .bold)).foregroundColor(checked ? p.ink : p.inkFaint)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title.uppercased()).font(AppFont.mono(12, checked ? .bold : .regular)).em(0.04, 12)
                        .foregroundColor(checked ? p.ink : p.inkSoft)
                    if let sub { Text(sub).font(AppFont.mono(11)).foregroundColor(p.inkSoft) }
                }
                Spacer(minLength: 0)
            }
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
    }
}

/// Строка-ссылка раздела: «ЗАКАЗЫ / 2 активных чека ... →».
struct NavRow: View {
    @Environment(\.palette) private var p
    let title: String
    var sub: String? = nil
    var badge: String? = nil
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title.uppercased()).font(AppFont.mono(12, .bold)).em(0.04, 12).foregroundColor(p.ink)
                if let sub { Text(sub).font(AppFont.text(13)).foregroundColor(p.inkSoft) }
            }
            Spacer(minLength: 8)
            if let badge { Text(badge).font(AppFont.mono(12, .bold)).foregroundColor(p.ink) }
            Text("→").font(AppFont.mono(13)).foregroundColor(p.ink)
        }
        .padding(.vertical, 14)
        .contentShape(Rectangle())
    }
}

/// Статистика «24 / ДРУЗЕЙ».
struct StatCell: View {
    @Environment(\.palette) private var p
    let value: String
    let label: String
    var accent = false
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(AppFont.display(20)).em(-0.01, 20).foregroundColor(accent ? p.accent : p.ink).lineLimit(1).minimumScaleFactor(0.6)
            Text(label.uppercased()).font(AppFont.mono(10)).em(0.04, 10).foregroundColor(p.inkSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
