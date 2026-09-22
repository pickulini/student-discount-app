import SwiftUI

struct RegisterView: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss

    @State private var fullName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var referralCode = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.xxl) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                        Text("АККАУНТ")
                            .font(Theme.Typography.label)
                            .foregroundStyle(Theme.Colors.textSecondary)
                        TextField("Имя и фамилия", text: $fullName)
                            .textFieldStyle(.route)
                            .textContentType(.name)
                        TextField("Email", text: $email)
                            .textFieldStyle(.route)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        SecureField("Пароль", text: $password)
                            .textFieldStyle(.route)
                            .textContentType(.newPassword)
                    }

                    VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                        Text("НЕОБЯЗАТЕЛЬНО")
                            .font(Theme.Typography.label)
                            .foregroundStyle(Theme.Colors.textSecondary)
                        TextField("Реферальный код", text: $referralCode)
                            .textFieldStyle(.route)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                    }

                    if let error = session.errorMessage {
                        Text(error)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(.red)
                    }

                    Button {
                        Task {
                            await session.register(
                                email: email,
                                password: password,
                                fullName: fullName,
                                referralCode: referralCode
                            )
                            if session.isAuthenticated { dismiss() }
                        }
                    } label: {
                        if session.isLoading {
                            RouteLoadingIndicator()
                        } else {
                            Text("Создать аккаунт")
                        }
                    }
                    .buttonStyle(.routePrimary)
                    .disabled(fullName.isEmpty || email.isEmpty || password.isEmpty || session.isLoading)
                }
                .padding(Theme.Spacing.xxl)
            }
            .background(Theme.Colors.background.ignoresSafeArea())
            .navigationTitle("Регистрация")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }
            }
        }
    }
}
