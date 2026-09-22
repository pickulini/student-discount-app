import SwiftUI

/// Минимальная текстовая навигация по категориям — НЕ десяток серых пилюль.
/// Активная категория отмечается лаймовой точкой снизу.
struct CategoryTabs: View {
    let categories: [String]
    @Binding var selected: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.xl) {
                ForEach(categories, id: \.self) { category in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) { selected = category }
                    } label: {
                        VStack(spacing: 6) {
                            Text(category)
                                .font(Theme.Typography.body)
                                .foregroundStyle(
                                    selected == category
                                        ? Theme.Colors.textPrimary
                                        : Theme.Colors.textSecondary
                                )
                            Circle()
                                .fill(selected == category ? Theme.Colors.accent : .clear)
                                .frame(width: 4, height: 4)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Theme.Spacing.l)
        }
    }
}
