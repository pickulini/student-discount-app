import SwiftUI

/// Сквозной визуальный мотив приложения: пунктирный путь — движение,
/// маршрут, путешествие по городу. Используется как разделитель, в лого,
/// в лоадере и в переходах. Точки всегда тонкие и низкоконтрастные —
/// мотив не должен доминировать.

/// Горизонтальный пунктирный разделитель контента.
struct DottedDivider: View {
    var color: Color = Theme.Colors.divider
    var dotSize: CGFloat = 2.5
    var spacing: CGFloat = 7

    var body: some View {
        GeometryReader { proxy in
            let count = max(Int(proxy.size.width / (dotSize + spacing)), 1)
            HStack(spacing: spacing) {
                ForEach(0..<count, id: \.self) { _ in
                    Circle()
                        .fill(color)
                        .frame(width: dotSize, height: dotSize)
                }
            }
        }
        .frame(height: dotSize)
    }
}

/// Логотип-метафора: точка (студент) — пунктир (путь) — точка (место/событие).
/// Работает и как header-логотип, и как основа splash/loading-анимации.
struct RouteMark: View {
    var accent: Color = Theme.Colors.accent
    var dimmed: Color = Theme.Colors.textMuted
    var dotCount: Int = 5
    var pointDiameter: CGFloat = 8
    var animated: Bool = false

    @State private var revealed = 0

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(accent)
                .frame(width: pointDiameter, height: pointDiameter)

            ForEach(0..<dotCount, id: \.self) { index in
                Circle()
                    .fill(dimmed.opacity(animated && index >= revealed ? 0.15 : 1))
                    .frame(width: 3, height: 3)
            }

            Circle()
                .strokeBorder(accent, lineWidth: 1.5)
                .frame(width: pointDiameter, height: pointDiameter)
        }
        .onAppear {
            guard animated else { return }
            withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) {
                revealed = dotCount
            }
        }
    }
}

/// Лёгкий индикатор загрузки на основе того же мотива — «движение по маршруту».
struct RouteLoadingIndicator: View {
    var body: some View {
        TimelineView(.animation) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            HStack(spacing: 6) {
                ForEach(0..<7, id: \.self) { i in
                    let local = (t * 1.6 + Double(i) * 0.35).truncatingRemainder(dividingBy: 3)
                    let active = local < 1
                    Circle()
                        .fill(active ? Theme.Colors.accent : Theme.Colors.textMuted.opacity(0.3))
                        .frame(width: active ? 6 : 3, height: active ? 6 : 3)
                        .animation(.easeInOut(duration: 0.3), value: active)
                }
            }
        }
    }
}
