import SwiftUI

/// Вход и регистрация (макеты 10 и 11). Вход — корневой экран, регистрация — поверх.
struct AuthFlow: View {
    @State private var path = NavigationPath()
    var body: some View {
        NavigationStack(path: $path) {
            LoginView(onRegister: { path.append(AuthRoute.register) })
                .navigationDestination(for: AuthRoute.self) { r in
                    switch r {
                    case .register: RegisterView()
                    }
                }
        }
    }
}

enum AuthRoute: Hashable { case register }

// MARK: - Бренд

struct AuthBrand: View {
    @Environment(\.palette) private var p
    @State private var places = 0
    @State private var showServer = false

    var body: some View {
        VStack(spacing: 12) {
            Text("СТУДЕНТ−%").font(AppFont.display(32)).em(-0.03, 32).foregroundColor(p.ink)
                .onLongPressGesture(minimumDuration: 1.2) { showServer = true }
            Text(("Скидки для студентов" + (places > 0 ? " · \(Fmt.num(Double(places))) \(Fmt.plural(places, "место", "места", "мест"))" : "")).uppercased())
                .font(AppFont.mono(11)).em(0.06, 11).foregroundColor(p.inkSoft)
            Barcode(seed: 2026, height: 26).frame(width: 176)
            Rule2().padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 16)
        .task {
            if let r = try? await API.shared.request("GET", "stats/public", auth: false) { places = r.places.int ?? 0 }
        }
        .sheet(isPresented: $showServer) { ServerSheet() }
    }
}

/// Адрес сервера (для разработки): долгое нажатие на логотип.
struct ServerSheet: View {
    @Environment(\.palette) private var p
    @Environment(\.dismiss) private var dismiss
    @State private var url = AppConfig.server
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            SectionLabel("Адрес сервера")
            UnderlineField(label: "URL", text: $url, placeholder: AppConfig.defaultServer, mono: true, keyboard: .URL, autocap: .never)
            Button("Сохранить") { AppConfig.server = url; dismiss() }.buttonStyle(.primary)
            Button("По умолчанию") { AppConfig.server = ""; url = AppConfig.server }.buttonStyle(.bracket)
            Spacer()
        }
        .padding(20)
        .themedRoot()
        .presentationDetents([.medium])
    }
}

// MARK: - Вход

struct LoginView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    let onRegister: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var fieldError: String?
    @State private var busy = false
    @State private var forgot = false

    var body: some View {
        Screen(spacing: 24) {
            AuthBrand()
        } content: {
            Text("ВХОД").font(AppFont.display(30)).em(-0.02, 30).foregroundColor(p.ink)
            UnderlineField(label: "Email", text: $email, placeholder: "you@university.ru",
                           keyboard: .emailAddress, contentType: .username, autocap: .never)
            UnderlineField(label: "Пароль", text: $password, secure: true, error: fieldError, contentType: .password)
            ErrorText(text: error)
            Button(busy ? "Входим…" : "Войти") { Task { await submit() } }
                .buttonStyle(.primary)
                .disabled(busy || email.isEmpty || password.isEmpty)
            VStack(spacing: 8) {
                Button("Забыли пароль?") { withAnimation { forgot.toggle() } }.buttonStyle(.bracket)
                if forgot {
                    Text("Сброс пароля по почте пока не подключён. Если вы вошли на другом устройстве — смените пароль в настройках безопасности.")
                        .font(AppFont.text(13)).foregroundColor(p.inkSoft).multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: .infinity)
            Rule()
            VStack(spacing: 16) {
                Text("Ещё нет аккаунта?").font(AppFont.text(15)).foregroundColor(p.inkSoft)
                Button("Зарегистрироваться", action: onRegister).buttonStyle(.outline)
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func submit() async {
        busy = true
        error = nil
        fieldError = nil
        defer { busy = false }
        do {
            let r = try await API.shared.request("POST", "auth/login", body: .json(["email": email.trimmingCharacters(in: .whitespaces), "password": password]), auth: false)
            try await session.signIn(access: r.access_token.str, refresh: r.refresh_token.string)
        } catch let e as APIError {
            switch e.status {
            case 401: fieldError = "Неверный email или пароль"
            case 429: fieldError = "Слишком много попыток. Подождите минуту"
            default: error = e.localizedDescription
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Регистрация

struct RegisterView: View {
    @Environment(\.palette) private var p
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var session: Session

    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var referral = ""
    @State private var universities: [JSON] = []
    @State private var busy = false
    @State private var error: String?
    @State private var errorField: String?

    private var university: JSON? {
        guard let at = email.lastIndex(of: "@") else { return nil }
        let domain = email[email.index(after: at)...].trimmingCharacters(in: .whitespaces).lowercased()
        guard domain.contains(".") else { return nil }
        return universities.first { u in
            u.domains.array.contains { d in
                let d = d.str.lowercased()
                return domain == d || domain.hasSuffix("." + d)
            }
        }
    }

    var body: some View {
        Screen(spacing: 24) {
            BackHeader("Вход") { HeaderMeta("Шаг 1 из 2") }
        } content: {
            VStack(alignment: .leading, spacing: 10) {
                Text("РЕГИСТРАЦИЯ").font(AppFont.display(30)).em(-0.02, 30).foregroundColor(p.ink)
                Text("Через почту вуза — мы сразу определим, где вы учитесь.").font(AppFont.text(16)).foregroundColor(p.inkSoft)
            }
            Rule2()
            UnderlineField(label: "Полное имя", text: $name, placeholder: "Имя Фамилия",
                           error: errorField == "name" ? error : nil, contentType: .name, autocap: .words)
            VStack(alignment: .leading, spacing: 8) {
                UnderlineField(label: "Email", text: $email, placeholder: "you@university.ru",
                               error: errorField == "email" ? error : nil, keyboard: .emailAddress, contentType: .username, autocap: .never)
                if email.contains("@"), email.split(separator: "@").last?.contains(".") == true {
                    if let u = university {
                        Leader(label: "Вуз определён", value: (u.short_name.string ?? u.name.str) + " ✓", valueBold: true)
                    } else {
                        Text("Вуз по этой почте не определили — выберете его при верификации.")
                            .font(AppFont.text(12)).foregroundColor(p.inkSoft)
                    }
                }
            }
            UnderlineField(label: "Пароль", text: $password, secure: true,
                           error: errorField == "password" ? error : (!password.isEmpty && password.count < 8 ? "Минимум 8 символов" : nil),
                           contentType: .newPassword)
            UnderlineField(label: "Реферальный код", text: $referral, placeholder: "например, 9a6c9829", mono: true, right: "НЕОБЯЗ.",
                           hint: "Если вас пригласил друг — он получит 100 бонусов, когда вы подтвердите статус студента.", autocap: .never)
            if errorField == nil { ErrorText(text: error) }
            Button(busy ? "Регистрируем…" : "Зарегистрироваться") { Task { await submit() } }
                .buttonStyle(.primary)
                .disabled(busy || name.isEmpty || email.isEmpty || password.isEmpty)
            Text("Нажимая кнопку, вы соглашаетесь с условиями и политикой конфиденциальности.")
                .font(AppFont.text(12)).foregroundColor(p.inkSoft)
            Rule()
            VStack(spacing: 16) {
                Text("Уже есть аккаунт?").font(AppFont.text(15)).foregroundColor(p.inkSoft)
                Button("Войти") { dismiss() }.buttonStyle(.outline)
            }
            .frame(maxWidth: .infinity)
        }
        .task {
            if let r = try? await API.shared.request("GET", "universities", auth: false) { universities = r.array }
        }
    }

    private func submit() async {
        error = nil
        errorField = nil
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { errorField = "name"; error = "Укажите имя"; return }
        guard password.count >= 8 else { errorField = "password"; error = "Минимум 8 символов"; return }
        busy = true
        defer { busy = false }
        do {
            let r = try await API.shared.request("POST", "auth/register", body: .json([
                "full_name": name.trimmingCharacters(in: .whitespaces),
                "email": email.trimmingCharacters(in: .whitespaces),
                "password": password,
                "referral_code": referral.trimmingCharacters(in: .whitespaces),
            ]), auth: false)
            try await session.signIn(access: r.access_token.string ?? r.token.str, refresh: r.refresh_token.string)
            // Шаг 2 — верификация; её можно пропустить и вернуться позже.
            session.push(.verification(afterRegister: true))
        } catch let e as APIError {
            let msg = e.localizedDescription
            if msg.contains("email") || msg.contains("Этот email") { errorField = "email" }
            error = msg
        } catch {
            self.error = error.localizedDescription
        }
    }
}
