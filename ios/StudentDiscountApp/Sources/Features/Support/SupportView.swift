import SwiftUI

/// Поддержка: сразу «чат» для нового обращения (тема + сообщение + «Отправить»),
/// ниже — активные обращения и история. Отдельной кнопки «Новое обращение» нет.
struct SupportView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    @Environment(\.scenePhase) private var phase
    var topic: String?

    @State private var tickets: [JSON]?
    @State private var loadError: String?
    @State private var theme = "order"
    @State private var orderRef: Int64?
    @State private var text = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    /// Темы обращения — вместо ручного ввода заголовка.
    private static let themes: [(String, String)] = [
        ("order", "Заказ и оплата"),
        ("wallet", "Кошелёк и бонусы"),
        ("verification", "Верификация"),
        ("events", "Ивенты"),
        ("account", "Аккаунт"),
        ("other", "Другое"),
    ]

    private func isOpen(_ t: JSON) -> Bool { ["open", "in_progress"].contains(t.status.str) }
    private var canSend: Bool { !busy && !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        if let tickets {
            let active = tickets.filter(isOpen)
            let closed = tickets.filter { !isOpen($0) }
            Screen(spacing: 20, onRefresh: load) {
                BackHeader("Профиль")
            } content: {
                Text("ПОДДЕРЖКА").font(AppFont.display(34)).em(-0.02, 34).foregroundColor(p.ink)
                Text("Отвечаем с 9:00 до 23:00, обычно за 15 минут.").font(AppFont.text(14)).foregroundColor(p.inkSoft).padding(.top, -6)

                if let loadError {
                    AlertBlock(title: "Не удалось загрузить обращения", text: loadError)
                    Button("Повторить") { Task { await load() } }.buttonStyle(.bracket)
                }

                if !active.isEmpty {
                    Rule2()
                    SectionLabel(active.count == 1 ? "Активное обращение" : "Активные обращения")
                    ticketList(active)
                }

                Rule2()
                composer

                if !closed.isEmpty {
                    Rule2()
                    SectionLabel("История")
                    ticketList(closed)
                }
            }
            .task {
                // Метка «● НОВЫЙ ОТВЕТ» появляется без обновления экрана; опрос — запасной путь.
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 30_000_000_000)
                    if phase == .active { await load() }
                }
            }
            .onChange(of: session.liveEvent) { e in
                if e?.name == "support_message" { Task { await load() } }
            }
            .onChange(of: phase) { ph in if ph == .active { Task { await load() } } }
        } else {
            LoadingScreen("Загружаем обращения…") { BackHeader("Профиль") }
                .task {
                    prefill()
                    await load()
                }
        }
    }

    /// Новое обращение в виде чата: выбрать тему и сразу писать.
    private var composer: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionLabel("Новое обращение")
            VStack(alignment: .leading, spacing: 8) {
                Text("ТЕМА").font(AppFont.mono(11, .medium)).em(0.06, 11).foregroundColor(p.inkSoft)
                ChipTabs(items: Self.themes, value: $theme, scroll: true)
                if let orderRef, theme == "order" {
                    Meta("Заказ № \(Fmt.pad(orderRef))")
                }
            }
            HStack(alignment: .bottom, spacing: 12) {
                TextField("", text: $text, prompt: Text(placeholder).foregroundColor(p.inkFaint), axis: .vertical)
                    .lineLimit(1...6).font(AppFont.text(16)).foregroundColor(p.ink).focused($focused)
                MonoLink(text: busy ? "…" : "Отправить →", bold: true, color: canSend ? p.ink : p.inkSoft) {
                    Task { await send() }
                }
                .disabled(!canSend)
            }
            .padding(.bottom, 12)
            .overlay(alignment: .bottom) { Rectangle().fill(focused ? p.ink : p.inkFaint).frame(height: 1) }
            ErrorText(text: error)
        }
    }

    private var placeholder: String {
        switch theme {
        case "order": return "Что случилось с заказом?"
        case "wallet": return "Что не так с балансом или бонусами?"
        case "verification": return "Что не получилось с подтверждением?"
        case "events": return "Какой ивент и что случилось?"
        case "account": return "Что случилось с аккаунтом?"
        default: return "Напишите, чем помочь"
        }
    }

    private func ticketList(_ list: [JSON]) -> some View {
        VStack(spacing: 14) {
            ForEach(Array(list.enumerated()), id: \.offset) { i, t in
                if i > 0 { Rule() }
                Button { session.push(.supportChat(t["id"].id)) } label: { ticketRow(t) }.buttonStyle(.plain)
            }
        }
    }

    private func prefill() {
        guard let topic else { return }
        if topic == "verification" { theme = "verification" }
        if topic.hasPrefix("order:"), let id = Int64(topic.dropFirst(6)) {
            theme = "order"
            orderRef = id
        }
    }

    private func ticketRow(_ t: JSON) -> some View {
        let open = isOpen(t)
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("№ \(Fmt.pad(t["id"].id, 4))").foregroundColor(p.inkSoft)
                Spacer()
                Text(open ? "ОТКРЫТО" : "ЗАКРЫТО").bold().foregroundColor(open ? p.ink : p.inkSoft)
            }
            .font(AppFont.mono(11)).em(0.04, 11)
            Text(t.subject.str).font(AppFont.text(15, .semibold)).foregroundColor(open ? p.ink : p.inkSoft).multilineTextAlignment(.leading)
            HStack(spacing: 10) {
                if open {
                    Text("\(t.last_from_staff.bool ? "ОТВЕТ" : "ОТПРАВЛЕНО") \(Fmt.ago(t.last_message_at.date ?? t.updated_at.date).uppercased())").foregroundColor(p.inkSoft)
                    if t.last_from_staff.bool { Text("● НОВЫЙ ОТВЕТ").bold().foregroundColor(p.accent) }
                } else {
                    Text("\(Fmt.ddmm(t.closed_at.date ?? t.updated_at.date)) · РЕШЕНО").foregroundColor(p.inkSoft)
                }
            }
            .font(AppFont.mono(11)).em(0.02, 11)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    /// Тема обращения для списка и админки: выбранная тема (+ номер заказа).
    private var subject: String {
        let label = Self.themes.first { $0.0 == theme }?.1 ?? "Другое"
        if theme == "order", let orderRef { return "Проблема с заказом № \(Fmt.pad(orderRef))" }
        if theme == "other" {
            let t = text.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "\n", with: " ")
            return t.count > 60 ? String(t.prefix(57)) + "…" : t
        }
        return label
    }

    private func send() async {
        let msg = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !msg.isEmpty else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let r = try await API.shared.post("support/tickets", ["subject": subject, "first_message": msg])
            text = ""
            orderRef = nil
            focused = false
            await load()
            session.push(.supportChat(r["id"].id))
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func load() async {
        do {
            let r = try await API.shared.get("support/overview")
            tickets = r.array
            loadError = nil
        } catch is CancellationError {
            return
        } catch {
            // Раньше ошибка молча превращалась в «Обращений пока не было».
            loadError = error.localizedDescription
            if tickets == nil { tickets = [] }
        }
    }
}

/// Переписка по обращению: свои сообщения справа, ответы поддержки — красным слева.
struct SupportChatView: View {
    @Environment(\.palette) private var p
    @Environment(\.scenePhase) private var phase
    @EnvironmentObject private var session: Session
    let ticketID: Int64

    @State private var ticket: JSON = .null
    @State private var thread: [JSON] = []
    @State private var text = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    private var open: Bool { ["open", "in_progress"].contains(ticket.status.str) }
    private var canSend: Bool { !busy && !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    private func composer(_ proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ErrorText(text: error)
            HStack(alignment: .bottom, spacing: 12) {
                TextField("", text: $text, prompt: Text("Введите сообщение…").foregroundColor(p.inkFaint), axis: .vertical)
                    .lineLimit(1...5).font(AppFont.text(16)).foregroundColor(p.ink).focused($focused)
                MonoLink(text: busy ? "…" : "Отправить →", bold: true, color: canSend ? p.ink : p.inkSoft) {
                    Task { await send() }
                }
                .disabled(!canSend)
            }
            .padding(.bottom, 10)
            .overlay(alignment: .bottom) { Rectangle().fill(focused ? p.ink : p.inkFaint).frame(height: 1) }
        }
        .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 8)
        .background(p.bg.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { DashLine().stroke(p.inkFaint, style: StrokeStyle(lineWidth: 1, dash: [3, 3])).frame(height: 1) }
    }

    var body: some View {
        ScrollViewReader { proxy in
            Screen(spacing: 20, onRefresh: load) {
                BackHeader("Обращения") { HeaderMeta(open ? "Открыто" : ticket.isNull ? "" : "Закрыто") }
            } content: {
                Meta("Обращение № \(Fmt.pad(ticketID, 4))")
                Text(ticket.subject.str).font(AppFont.display(20)).foregroundColor(p.ink).fixedSize(horizontal: false, vertical: true).padding(.top, -12)
                Rule2()
                VStack(spacing: 22) {
                    ForEach(Array(thread.enumerated()), id: \.offset) { i, m in
                        let day = m.created_at.date.map { Calendar.current.startOfDay(for: $0) }
                        let prev = i > 0 ? thread[i - 1].created_at.date.map { Calendar.current.startOfDay(for: $0) } : day
                        if day != prev, let day {
                            Text("- - -   \(Fmt.ddmm(day))   - - -").font(AppFont.mono(11)).foregroundColor(p.inkFaint)
                        }
                        message(m)
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                if open {
                    Rule2()
                    Button("Вопрос решён — закрыть") { Task { await close() } }.buttonStyle(.bracket).frame(maxWidth: .infinity).disabled(busy)
                } else if !ticket.isNull {
                    Rule2()
                    Text("Обращение закрыто. Если вопрос остался — напишите новое.").font(AppFont.text(14)).foregroundColor(p.inkSoft)
                }
            }
            // Поле ввода закреплено внизу: переписка листается, а оно всегда на виду
            // (и поднимается вместе с клавиатурой).
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if open { composer(proxy) }
            }
            .onChange(of: thread.count) { _ in withAnimation { proxy.scrollTo("bottom") } }
            .onChange(of: focused) { f in
                if f { DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { withAnimation { proxy.scrollTo("bottom") } } }
            }
        }
        .task {
            await load()
            // Запасной опрос — на случай, если поток событий оборвался.
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 15_000_000_000)
                if phase == .active { await load() }
            }
        }
        // Живой чат: новое сообщение приходит событием support_message — перечитываем сразу.
        .onChange(of: session.liveEvent) { e in
            guard let e, e.name == "support_message", e.payload.ticket_id.int64 == ticketID else { return }
            Task { await load() }
        }
        .onChange(of: phase) { ph in if ph == .active { Task { await load() } } }
    }

    @ViewBuilder
    private func message(_ m: JSON) -> some View {
        let stamp = "\(Fmt.ddmm(m.created_at.date)) \(Fmt.hhmm(m.created_at.date))"
        if m.mine.bool {
            VStack(alignment: .trailing, spacing: 6) {
                Text("ВЫ · \(stamp)").font(AppFont.mono(10, .bold)).em(0.06, 10).foregroundColor(p.inkSoft)
                messageText(m.message.str).multilineTextAlignment(.trailing).foregroundColor(p.ink)
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
            .padding(.leading, 32)
        } else {
            HStack(alignment: .top, spacing: 14) {
                VRule(color: p.accent)
                VStack(alignment: .leading, spacing: 6) {
                    Text("ПОДДЕРЖКА" + (m.author_name.string.map { " · \($0.uppercased())" } ?? "") + " · \(stamp)")
                        .font(AppFont.mono(10, .bold)).em(0.06, 10).foregroundColor(p.accent)
                    messageText(m.message.str).foregroundColor(p.accent)
                }
                Spacer(minLength: 24)
            }
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// Ссылки на загруженные файлы — кликабельны («Файл»).
    private func messageText(_ s: String) -> Text {
        var out = Text("")
        for (i, part) in s.components(separatedBy: .whitespacesAndNewlines).enumerated() {
            let sep = i > 0 ? " " : ""
            if part.hasPrefix("/uploads/") || part.hasPrefix("http") {
                var a = AttributedString("Файл")
                a.link = AppConfig.mediaURL(part)
                a.underlineStyle = .single
                out = out + Text(sep) + Text(a)
            } else {
                out = out + Text(sep + part)
            }
        }
        return out.font(AppFont.text(15))
    }

    private func load() async {
        if let all = try? await API.shared.get("support/overview") {
            ticket = all.array.first { $0["id"].id == ticketID } ?? ticket
        }
        thread = (try? await API.shared.get("support/tickets/\(ticketID)/thread"))?.array ?? thread
    }

    private func send() async {
        let msg = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !msg.isEmpty else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await API.shared.post("support/tickets/\(ticketID)/messages", ["message": msg])
            text = ""
            await load()
        } catch {
            self.error = "Не отправилось"
        }
    }

    private func close() async {
        busy = true
        defer { busy = false }
        try? await API.shared.post("support/tickets/\(ticketID)/close")
        await load()
    }
}
