import SwiftUI

/// Минималистичное поле ввода без карточной рамки — тонкая нижняя линия,
/// в духе редакторского, не e-commerce интерфейса.
struct AppTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(Theme.Typography.body)
            .foregroundStyle(Theme.Colors.textPrimary)
            .padding(.vertical, 12)
            .background(alignment: .bottom) {
                Rectangle()
                    .fill(Theme.Colors.divider)
                    .frame(height: 1)
            }
    }
}

extension TextFieldStyle where Self == AppTextFieldStyle {
    static var route: AppTextFieldStyle { AppTextFieldStyle() }
}
