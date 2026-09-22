import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: SessionStore

    @State private var email = ""
    @State private var password = ""
    @State private var showingRegister = false
    @State private var showingServerSettings = false

    var body: some View {
        NavigationStack {
            VStack(spacing: Theme.Spacing.xxl) {
                Spacer()

                VStack(spacing: Theme.Spacing.m) {
                    RouteMark()
                    Text("Student Discount")
                        .font(Theme.Typography.title)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text("Открывай город")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }

                VStack(spacing: Theme.Spacing.l) {
                    TextField("Email", text: $email)
                        .textFieldStyle(.route)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    SecureField("Пароль", text: $password)
                        .textFieldStyle(.route)
                        .textContentType(.password)
                }
                .padding(.horizontal, Theme.Spacing.xxl)

                if let error = session.errorMessage {
                    Text(error)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Theme.Spacing.xxl)
                }

                VStack(spacing: Theme.Spacing.l) {
                    Button {
                        Task { await session.login(email: email, password: password) }
                    } label: {
                        if session.isLoading {
                            RouteLoadingIndicator()
                        } else {
                            Text("Войти")
                        }
                    }
                    .buttonStyle(.routePrimary)
                    .disabled(email.isEmpty || password.isEmpty || session.isLoading)

                    Button("Создать аккаунт") { showingRegister = true }
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
                .padding(.horizontal, Theme.Spacing.xxl)

                Spacer()

                Button { showingServerSettings = true } label: {
                    Text("Адрес сервера")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textMuted)
                }
                .padding(.bottom, Theme.Spacing.l)
            }
            .background(Theme.Colors.background.ignoresSafeArea())
            .sheet(isPresented: $showingRegister) { RegisterView() }
            .sheet(isPresented: $showingServerSettings) { ServerSettingsView() }
        }
    }
}

struct ServerSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var urlString = AppConfig.serverURLString

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                Text("АДРЕС СЕРВЕРА")
                    .font(Theme.Typography.label)
                    .foregroundStyle(Theme.Colors.textSecondary)

                TextField("http://ваш-сервер", text: $urlString)
                    .textFieldStyle(.route)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                Text("Тот же адрес, что вы открываете в браузере. «localhost» с телефона указывает на сам телефон, а не на сервер.")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textMuted)

                Spacer()
            }
            .padding(Theme.Spacing.xxl)
            .background(Theme.Colors.background.ignoresSafeArea())
            .navigationTitle("Сервер")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Сохранить") {
                        AppConfig.serverURLString = urlString
                        dismiss()
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }
            }
        }
    }
}
