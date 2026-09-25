import SwiftUI
import PhotosUI

/// Шапка раздела настроек: заголовок, подзаголовок, двойная черта.
struct PanelHead: View {
    @Environment(\.palette) private var p
    let title: String
    var subtitle: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased()).font(AppFont.display(30)).em(-0.02, 30).foregroundColor(p.ink).lineLimit(1).minimumScaleFactor(0.7)
            if let subtitle { Text(subtitle).font(AppFont.text(14)).foregroundColor(p.inkSoft) }
        }
        Rule2()
    }
}

/// Строка настройки: подпись и пояснение слева, переключатель справа.
struct SettingRow<Right: View>: View {
    @Environment(\.palette) private var p
    let title: String
    var hint: String? = nil
    var dim = false
    let right: Right
    init(_ title: String, hint: String? = nil, dim: Bool = false, @ViewBuilder right: () -> Right) {
        self.title = title
        self.hint = hint
        self.dim = dim
        self.right = right()
    }
    var body: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title.uppercased()).font(AppFont.mono(12, .bold)).em(0.04, 12).foregroundColor(p.ink)
                if let hint { Text(hint).font(AppFont.text(14)).foregroundColor(p.inkSoft).fixedSize(horizontal: false, vertical: true) }
            }
            Spacer(minLength: 8)
            right
        }
        .opacity(dim ? 0.4 : 1)
    }
}

struct OnOff: View {
    @Binding var value: Bool
    var body: some View { Segmented(items: [(true, "Вкл"), (false, "Выкл")], value: $value) }
}

/// «✓ СОХРАНЕНО · 00:52»
struct SavedMark: View {
    @Environment(\.palette) private var p
    let at: Date?
    let text: String
    var body: some View {
        if let at {
            Text("✓ \(text.uppercased()) · \(Fmt.hhmm(at))").font(AppFont.mono(11, .bold)).em(0.04, 11).foregroundColor(p.ink).frame(maxWidth: .infinity)
        }
    }
}

// MARK: - 60 · Настройки

struct SettingsView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    @AppStorage("theme") private var theme: String = ThemePref.auto.rawValue

    var body: some View {
        let verified = session.user.student_status.str == "verified"
        let pending = session.user.student_status.str == "pending"
        Screen(spacing: 20) {
            BackHeader("Профиль")
        } content: {
            Text("НАСТРОЙКИ").font(AppFont.display(34)).em(-0.02, 34).foregroundColor(p.ink)
            Rule2()
            VStack(spacing: 0) {
                link(.settingsProfile, "Профиль", "Никнейм, username, аватар")
                Rule()
                link(.verification(afterRegister: false), "Верификация", pending ? "Заявка на проверке" : "Статус студента", badge: verified ? "✓" : nil)
                Rule()
                link(.settingsPrivacy, "Приватность", "Кто видит ваш профиль")
                Rule()
                link(.settingsNotifications, "Уведомления", "Что вам присылать")
                Rule()
                link(.settingsSecurity, "Безопасность", "Пароль и активные сессии")
                Rule()
                link(.settingsAccount, "Аккаунт", "Баланс, рефералы, удаление")
            }
            .padding(.vertical, -4)
            Rule2()
            SectionLabel("Оформление")
            SettingRow("Тема", hint: "По умолчанию — как в системе телефона") {
                Segmented(items: ThemePref.allCases.map { ($0.rawValue, $0.label) }, value: $theme)
            }
            Rule()
            Text("ВЕРСИЯ \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0") · iOS")
                .font(AppFont.mono(11)).em(0.04, 11).foregroundColor(p.inkFaint).frame(maxWidth: .infinity)
        }
    }

    private func link(_ r: Route, _ title: String, _ sub: String, badge: String? = nil) -> some View {
        Button { session.push(r) } label: { NavRow(title: title, sub: sub, badge: badge) }.buttonStyle(.plain)
    }
}

// MARK: - 61 · Профиль

struct SettingsProfileView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    @State private var nickname = ""
    @State private var username = ""
    @State private var avatar = ""
    @State private var check: String? // free | taken | invalid | checking
    @State private var saving = false
    @State private var savedAt: Date?
    @State private var error: String?
    @State private var loaded = false
    @State private var uploading = false

    var body: some View {
        Screen(spacing: 22) {
            BackHeader("Настройки")
        } content: {
            PanelHead(title: "Профиль")
            HStack(spacing: 20) {
                Avatar(url: avatar.isEmpty ? nil : avatar, name: nickname.isEmpty ? session.user.full_name.str : nickname, size: 88)
                VStack(alignment: .leading, spacing: 8) {
                    AvatarPickerButton(uploading: $uploading) { url in avatar = url; savedAt = nil }
                    Text("JPG или PNG, до 5 МБ").font(AppFont.text(13)).foregroundColor(p.inkSoft)
                }
            }
            Rule2()
            UnderlineField(label: "Никнейм", text: $nickname, placeholder: session.user.full_name.str)
            UnderlineField(label: "Username (@тег)", text: $username, placeholder: "anna_p", mono: true,
                           right: checkLabel, error: check == "taken" ? "Уже занят" : check == "invalid" ? "Только латиница, цифры, _ (3–30)" : nil,
                           hint: "3–30 символов: латиница, цифры, _", autocap: .never)
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("ВУЗ").font(AppFont.mono(11, .medium)).em(0.06, 11).foregroundColor(p.inkSoft)
                    Spacer()
                    Image(systemName: "lock.fill").font(.system(size: 10)).foregroundColor(p.inkFaint)
                }
                Text(session.user.university_name.string ?? session.user.university_short.string ?? "—").font(AppFont.text(16)).foregroundColor(p.inkSoft)
                    .padding(.bottom, 10).frame(maxWidth: .infinity, alignment: .leading).overlay(alignment: .bottom) { Rule() }
                Text("Меняется только через повторную верификацию.").font(AppFont.text(12)).foregroundColor(p.inkSoft)
            }
            ErrorText(text: error)
            Button(saving ? "Сохраняем…" : "Сохранить") { Task { await save() } }
                .buttonStyle(.primary).disabled(saving || uploading || check == "checking" || check == "taken" || check == "invalid")
            SavedMark(at: savedAt, text: "Профиль обновлён")
        }
        .task {
            guard !loaded else { return }
            loaded = true
            nickname = session.user.nickname.str
            username = session.user.username.str
            avatar = session.user.avatar_url.str
        }
        .onChange(of: username) { v in Task { await checkUsername(v) } }
    }

    private var checkLabel: String? {
        switch check {
        case "free": return "✓ СВОБОДЕН"
        case "checking": return "ПРОВЕРЯЕМ…"
        default: return nil
        }
    }

    private func checkUsername(_ v: String) async {
        let u = v.trimmingCharacters(in: .whitespaces)
        savedAt = nil
        if u.isEmpty || u == session.user.username.str { check = nil; return }
        guard u.range(of: "^[a-z0-9_]{3,30}$", options: .regularExpression) != nil else { check = "invalid"; return }
        check = "checking"
        try? await Task.sleep(nanoseconds: 350_000_000)
        guard u == username.trimmingCharacters(in: .whitespaces) else { return }
        let r = try? await API.shared.get("users/username-available", ["u": u])
        check = r.map { $0.available.bool ? "free" : "taken" }
    }

    private func save() async {
        saving = true
        error = nil
        defer { saving = false }
        do {
            try await API.shared.patch("users/me", ["nickname": nickname.trimmingCharacters(in: .whitespaces),
                                                    "username": username.trimmingCharacters(in: .whitespaces),
                                                    "avatar_url": avatar])
            await session.refreshUser()
            check = nil
            savedAt = Date()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// «[ СМЕНИТЬ ФОТО ]»: выбор из галереи, сжатие, загрузка.
struct AvatarPickerButton: View {
    @Environment(\.palette) private var p
    @Binding var uploading: Bool
    let onUploaded: (String) -> Void
    @State private var item: PhotosPickerItem?
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            PhotosPicker(selection: $item, matching: .images) {
                Text(uploading ? "[ ЗАГРУЖАЕМ… ]" : "[ СМЕНИТЬ ФОТО ]").font(AppFont.mono(12, .medium)).em(0.04, 12).foregroundColor(p.ink)
            }
            .disabled(uploading)
            ErrorText(text: error)
        }
        .onChange(of: item) { it in
            guard let it else { return }
            Task {
                uploading = true
                error = nil
                defer { uploading = false; item = nil }
                guard let data = try? await it.loadTransferable(type: Data.self), let img = UIImage(data: data), let jpeg = ImageTools.jpeg(img, max: 800) else {
                    error = "Не удалось прочитать фото"
                    return
                }
                do { onUploaded(try await API.shared.upload(jpeg)) } catch { self.error = error.localizedDescription }
            }
        }
    }
}

// MARK: - 62 · Приватность

struct SettingsPrivacyView: View {
    @Environment(\.palette) private var p
    @State private var vals: [String: String]?
    @State private var searchable = true
    @State private var saving = false
    @State private var savedAt: Date?
    @State private var error: String?

    private let rows: [(String, [String], String, String)] = [
        ("profile", ["avatar_visibility", "university_visibility"], "Профиль", "Имя, вуз, аватар"),
        ("friends", ["friends_list_visibility"], "Друзья", "Список ваших друзей"),
        ("subs", ["subscriptions_visibility"], "Подписки", "Места, на которые вы подписаны"),
        ("going", ["attending_events_visibility"], "Планирую посетить", "Ивенты, на которые вы идёте"),
        ("saved", ["statistics_visibility"], "Сэкономлено", "Сумма в журнале экономии"),
    ]
    private let rank = ["public": 0, "friends": 1, "private": 2]

    var body: some View {
        Screen(spacing: 22) {
            BackHeader("Настройки")
        } content: {
            PanelHead(title: "Приватность", subtitle: "Кто что видит в вашем публичном профиле.")
            if let vals {
                ForEach(Array(rows.enumerated()), id: \.offset) { i, r in
                    if i > 0 { Rule() }
                    SettingRow(r.2, hint: r.3) {
                        Segmented(items: [("public", "Все"), ("friends", "Друзья"), ("private", "Никто")],
                                  value: Binding(get: { vals[r.0] ?? "public" }, set: { self.vals?[r.0] = $0; savedAt = nil }))
                    }
                }
                Rule2()
                SettingRow("Показывать в поиске", hint: "Вас можно найти по @username") {
                    OnOff(value: Binding(get: { searchable }, set: { searchable = $0; savedAt = nil }))
                }
                ErrorText(text: error)
                Button(saving ? "Сохраняем…" : "Сохранить") { Task { await save() } }.buttonStyle(.primary).disabled(saving)
                SavedMark(at: savedAt, text: "Сохранено")
            } else {
                LoadingView().frame(height: 200)
            }
        }
        .task { await load() }
    }

    private func load() async {
        guard let me = try? await API.shared.get("users/me") else { error = "Не удалось загрузить настройки"; return }
        var next: [String: String] = [:]
        for r in rows {
            next[r.0] = r.1.map { me[$0].string ?? "public" }.max { (rank[$0] ?? 0) < (rank[$1] ?? 0) } ?? "public"
        }
        vals = next
        searchable = me.searchable.isNull ? true : me.searchable.bool
    }

    private func save() async {
        guard let vals else { return }
        saving = true
        error = nil
        defer { saving = false }
        var body: [String: Any] = [:]
        for r in rows { for f in r.1 { body[f] = vals[r.0] ?? "public" } }
        do {
            try await API.shared.patch("users/me/privacy", body)
            try await API.shared.patch("users/me/search-visibility", ["searchable": searchable])
            savedAt = Date()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - 63 · Уведомления

struct SettingsNotificationsView: View {
    @Environment(\.palette) private var p
    @State private var s: [String: Bool]?
    @State private var saving = false
    @State private var savedAt: Date?
    @State private var error: String?

    private let rows = [("orders", "Заказы", "Оплата, чек, срок действия кода"),
                        ("offers", "Офферы", "Новые предложения компаний из подписок"),
                        ("events", "Ивенты", "Новые ивенты подписок и друзей, напоминания"),
                        ("friends", "Друзья", "Заявки в друзья и принятие")]

    var body: some View {
        Screen(spacing: 22) {
            BackHeader("Настройки")
        } content: {
            PanelHead(title: "Уведомления", subtitle: "Выберите, что вам присылать.")
            if let s {
                let enabled = s["enabled"] ?? true
                SettingRow("Все уведомления", hint: "Главный выключатель") { OnOff(value: bind("enabled")) }
                Rule2()
                ForEach(Array(rows.enumerated()), id: \.offset) { i, r in
                    if i > 0 { Rule() }
                    SettingRow(r.1, hint: r.2, dim: !enabled) { OnOff(value: bind(r.0)).disabled(!enabled) }
                }
                Rule2()
                SettingRow("Тихие часы", hint: "23:00–09:00 — без звука", dim: !enabled) { OnOff(value: bind("quiet")).disabled(!enabled) }
                ErrorText(text: error)
                Button(saving ? "Сохраняем…" : "Сохранить") { Task { await save() } }.buttonStyle(.primary).disabled(saving)
                SavedMark(at: savedAt, text: "Сохранено")
            } else {
                LoadingView().frame(height: 200)
            }
        }
        .task {
            guard s == nil else { return }
            if let r = try? await API.shared.get("users/me/notification-settings") {
                s = ["enabled": r.enabled.isNull || r.enabled.bool, "orders": r.orders.isNull || r.orders.bool,
                     "offers": r.offers.isNull || r.offers.bool, "events": r.events.isNull || r.events.bool,
                     "friends": r.friends.isNull || r.friends.bool, "quiet": r.quiet.bool]
            } else {
                error = "Не удалось загрузить настройки"
            }
        }
    }

    private func bind(_ k: String) -> Binding<Bool> {
        Binding(get: { s?[k] ?? false }, set: { s?[k] = $0; savedAt = nil })
    }

    private func save() async {
        guard let s else { return }
        saving = true
        error = nil
        defer { saving = false }
        do {
            try await API.shared.patch("users/me/notification-settings", s)
            savedAt = Date()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - 64 · Безопасность

struct SettingsSecurityView: View {
    @Environment(\.palette) private var p
    @State private var old = ""
    @State private var next = ""
    @State private var again = ""
    @State private var changing = false
    @State private var changedAt: Date?
    @State private var pwError: String?
    @State private var sessions: [JSON]?
    @State private var busy: Int64?
    @State private var sessError: String?

    var body: some View {
        let tooShort = !next.isEmpty && next.count < 8
        let mismatch = !again.isEmpty && again != next
        Screen(spacing: 22) {
            BackHeader("Настройки")
        } content: {
            Text("БЕЗОПАСНОСТЬ").font(AppFont.display(30)).em(-0.02, 30).foregroundColor(p.ink).lineLimit(1).minimumScaleFactor(0.7)
            SectionLabel("Смена пароля")
            UnderlineField(label: "Текущий пароль", text: $old, placeholder: "—", secure: true, contentType: .password)
            UnderlineField(label: "Новый пароль", text: $next, placeholder: "—", secure: true, error: tooShort ? "Минимум 8 символов" : nil, contentType: .newPassword)
            UnderlineField(label: "Повторите новый пароль", text: $again, placeholder: "—", secure: true, error: mismatch ? "Пароли не совпадают" : nil, contentType: .newPassword)
            Button(changing ? "Меняем…" : "Изменить пароль") { Task { await change() } }.buttonStyle(.primary).disabled(changing)
            if let changedAt {
                SavedMark(at: changedAt, text: "Пароль изменён, другие сессии завершены")
            } else if let pwError {
                ErrorText(text: pwError)
            } else {
                Text("После смены пароля все сессии будут завершены.").font(AppFont.text(13)).foregroundColor(p.inkSoft).frame(maxWidth: .infinity)
            }
            Rule2()
            SectionLabel("Активные сессии · \(sessions?.count ?? 0)")
            ErrorText(text: sessError)
            if let sessions {
                ForEach(Array(sessions.enumerated()), id: \.offset) { i, s in
                    if i > 0 { Rule() }
                    HStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(Self.device(s.user_agent.str).uppercased()).font(AppFont.mono(12, .bold)).em(0.03, 12).foregroundColor(p.ink)
                            Text([s.ip.string.map { "IP \($0)" }, when(s)].compactMap { $0 }.joined(separator: " · ")).font(AppFont.text(14)).foregroundColor(p.inkSoft)
                        }
                        Spacer()
                        if s.current.bool {
                            Text("ЭТО УСТРОЙСТВО").font(AppFont.mono(11)).em(0.04, 11).foregroundColor(p.inkSoft)
                        } else {
                            MonoLink(text: busy == s["id"].id ? "Отзываем…" : "Отозвать", bold: true) { Task { await revoke(s["id"].id) } }.disabled(busy != nil)
                        }
                    }
                }
                if sessions.contains(where: { !$0.current.bool }) {
                    Button("Отозвать все, кроме этой") { Task { await revokeOthers() } }.buttonStyle(.bracket).frame(maxWidth: .infinity).disabled(busy != nil)
                }
            } else {
                Meta("Загружаем сессии…")
            }
        }
        .task { await loadSessions() }
    }

    static func device(_ ua: String) -> String {
        var dev = "Устройство"
        if ua.contains("iPhone") { dev = "iPhone" } else if ua.contains("iPad") { dev = "iPad" } else if ua.contains("Android") { dev = "Android" }
        else if ua.contains("Mac OS X") || ua.contains("Macintosh") { dev = "Mac" } else if ua.contains("Windows") { dev = "Windows" } else if ua.contains("Linux") { dev = "Linux" }
        var br = ""
        if ua.contains("StudentDiscountApp") { br = "Приложение" } else if ua.contains("YaBrowser") { br = "Яндекс Браузер" } else if ua.contains("Edg/") { br = "Edge" }
        else if ua.contains("Firefox/") { br = "Firefox" } else if ua.contains("Chrome/") { br = "Chrome" } else if ua.contains("Safari/") { br = "Safari" }
        if br == "Приложение" && dev == "Устройство" { dev = "iPhone" }
        return br.isEmpty ? dev : "\(dev) · \(br)"
    }

    private func when(_ s: JSON) -> String {
        guard let t = s.last_used_at.date ?? s.created_at.date else { return "" }
        if s.current.bool || Date().timeIntervalSince(t) < 180 { return "сейчас" }
        if Calendar.current.isDateInToday(t) { return "сегодня, \(Fmt.hhmm(t))" }
        if Date().timeIntervalSince(t) < 7 * 86400 { return "\(Fmt.ddmm(t)), \(Fmt.hhmm(t))" }
        return Fmt.ddmm(t)
    }

    private func change() async {
        guard !old.isEmpty else { pwError = "Введите текущий пароль"; return }
        guard next.count >= 8 else { pwError = "Новый пароль — минимум 8 символов"; return }
        guard again == next else { pwError = "Пароли не совпадают"; return }
        changing = true
        pwError = nil
        defer { changing = false }
        do {
            try await API.shared.patch("users/me/password", ["old_password": old, "new_password": next])
            old = ""; next = ""; again = ""
            changedAt = Date()
            await loadSessions()
        } catch {
            pwError = error.localizedDescription.lowercased().contains("invalid") ? "Текущий пароль неверный" : error.localizedDescription
        }
    }

    private func revoke(_ id: Int64) async {
        busy = id
        defer { busy = nil }
        do { try await API.shared.delete("users/me/sessions/\(id)"); await loadSessions() } catch { sessError = error.localizedDescription }
    }

    private func revokeOthers() async {
        busy = -1
        defer { busy = nil }
        do { try await API.shared.request("DELETE", "users/me/sessions", query: ["keep_current": "1"]); await loadSessions() } catch { sessError = error.localizedDescription }
    }

    private func loadSessions() async {
        sessions = (try? await API.shared.get("users/me/sessions"))?.array ?? []
    }
}

// MARK: - 65 · Аккаунт

struct SettingsAccountView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    @State private var me: JSON?
    @State private var code = ""
    @State private var password = ""
    @State private var deleting = false
    @State private var error: String?
    @State private var confirm = false

    var body: some View {
        Screen(spacing: 20) {
            BackHeader("Настройки")
        } content: {
            Text("АККАУНТ").font(AppFont.display(30)).em(-0.02, 30).foregroundColor(p.ink)
            if let me {
                let balance = me.balance.num
                let bonus = me.bonus_balance.num
                let lose = [balance > 0 ? "баланс \(Fmt.rub(balance))" : nil,
                            bonus > 0 ? "\(Fmt.num(bonus)) \(Fmt.plural(Int(bonus), "бонус", "бонуса", "бонусов"))" : nil].compactMap { $0 }
                let warning = lose.isEmpty ? "Удалятся заказы, друзья, подписки и журнал экономии."
                    : "Сгорят \(lose.joined(separator: " и ")), удалятся заказы и журнал экономии.\(balance > 0 ? " Сначала выведите деньги через поддержку." : "")"
                SectionLabel("Информация")
                VStack(spacing: 10) {
                    Leader(label: "Email", value: me.email.str)
                    Leader(label: "Роль", value: ["student": "Студент", "merchant": "Партнёр", "admin": "Администратор"][me.role.str] ?? me.role.str)
                    Leader(label: "Аккаунт создан", value: Fmt.ddmmyy(me.created_at.date))
                }
                Rule()
                SectionLabel("Кошелёк")
                VStack(spacing: 10) {
                    Leader(label: "Баланс", value: Fmt.rub(balance))
                    Leader(label: "Бонусы", value: "\(Fmt.num(bonus)) Б")
                    if !code.isEmpty { Leader(label: "Реферальный код", value: code.uppercased(), valueBold: true) }
                }
                Rule2()
                SectionLabel("Удаление аккаунта")
                AlertBlock(title: "Это необратимо", text: warning)
                UnderlineField(label: "Пароль для подтверждения", text: $password, placeholder: "••••••••", secure: true, error: error, contentType: .password)
                Button(deleting ? "Удаляем…" : "Удалить навсегда") {
                    if password.isEmpty { error = "Введите пароль" } else { confirm = true }
                }
                .buttonStyle(.outline).disabled(deleting)
            } else {
                LoadingView().frame(height: 200)
            }
        }
        .task {
            me = (try? await API.shared.get("users/me")) ?? .null
            code = (try? await API.shared.get("referral/code"))?.code.string ?? ""
        }
        .confirmationDialog("Удалить аккаунт навсегда?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Удалить", role: .destructive) { Task { await remove() } }
            Button("Отмена", role: .cancel) {}
        }
    }

    private func remove() async {
        deleting = true
        error = nil
        defer { deleting = false }
        do {
            try await API.shared.request("DELETE", "users/me", body: .json(["password": password]))
            session.signOut()
        } catch {
            self.error = error.localizedDescription.lowercased().contains("invalid") ? "Неверный пароль" : error.localizedDescription
        }
    }
}
