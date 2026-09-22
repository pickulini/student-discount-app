import SwiftUI

/// Редакторский заголовок секции — мелкий uppercase-лейбл, без карточной
/// обвязки. Используется для «РЯДОМ С ТОБОЙ», «ПОПУЛЯРНОЕ» и т.д.
struct SectionHeader: View {
    let title: String
    var action: (() -> Void)?
    var actionTitle: String = "Все"

    var body: some View {
        HStack {
            Text(title.uppercased())
                .font(Theme.Typography.label)
                .foregroundStyle(Theme.Colors.textSecondary)
                .tracking(0.5)
            Spacer()
            if let action {
                Button(actionTitle, action: action)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.accent)
            }
        }
    }
}

/// Мелкий бейдж-метрика — используется для скидки, счётчиков и т.д.
/// Акцент применяется точечно, не как заливка всего блока.
struct MetricBadge: View {
    let text: String
    var filled: Bool = false

    var body: some View {
        Text(text)
            .font(Theme.Typography.label)
            .foregroundStyle(filled ? Color.black : Theme.Colors.accent)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(filled ? Theme.Colors.accent : Theme.Colors.accent.opacity(0.12))
            .clipShape(Capsule())
    }
}
