import SwiftUI

/// Поддержка (макеты 55 и 56): список обращений, новое обращение, переписка.
struct SupportView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    @Environment(\.scenePhase) private var phase
    var topic: String?

    @State private var tickets: [JSON]?
    @State private var creating = false
    @State private var subject = ""
    @State private var first = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var subjectFocused: Bool

    private func isOpen(_ t: JSON) -> Bool { ["open", "in_progress"].contains(t.status.str) }

    var body: some View {
        if let tickets {
            ScrollViewReader { proxy in
                Screen(spacing: 20, onRefresh: load) {
                    BackHeader("Профиль")
                } content: {
                    Text("ПОДДЕРЖКА").font(AppFont.display(34)).em(-0.02, 34).foregroundColor(p.ink)
                    Text("Отвечаем с 9:00 до 23:00, обычно за 15 минут.").font(AppFont.text(14)).foregroundColor(p.inkSoft).padding(.top, -6)
                    Button("+ Новое обращение") {
                        creating = true
                        error = nil
                        // Форма ниже списка — прокручиваем к ней и ставим курсор в тему.
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            withAnimation { proxy.scrollTo("form", anchor: .top) }
                            subjectFocused = true
                        }
                    }
                    .buttonStyle(.primary)
                    Rule2()
                    SectionLabel("Ваши обращения")
                    if tickets.isEmpty {
                        Text("Обращений пока не было.").font(AppFont.text(14)).foregroundColor(p.inkSoft)
                    }
                    ForEach(Array(tickets.enumerated()), id: \.offset) { i, t in
                        if i > 0 { Rule() }
                        Button { session.push(.supportChat(t["id"].id)) } label: { ticketRow(t) }.buttonStyle(.plain)
                    }
                    if creating || tickets.isEmpty {
                        Rule2().id("form")
                        Meta("Новое обращение — форма")
                        VStack(alignment: .leading, spacing: 8) {
                            Text("ТЕМА").font(AppFont.mono(11, .medium)).em(0.06, 11).foregroundColor(p.inkSoft)
                            TextField("", text: $subject, prompt: Text("Коротко: что случилось").foregroundColor(p.inkFaint))
                                .font(AppFont.text(16)).foregroundColor(p.ink).focused($subjectFocused)
                                .padding(.bottom, 10).overlay(alignment: .bottom) { subjectFocused ? AnyView(Rectangle().fill(p.ink).frame(height: 1)) : AnyView(Rule()) }
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            Text("СООБЩЕНИЕ").font(AppFont.mono(11, .medium)).em(0.06, 11).foregroundColor(p.inkSoft)
                            TextField("", text: $first, prompt: Text("Опишите проблему: номер заказа, место, что пошло не так").foregroundColor(p.inkFaint), axis: .vertical)
                                .lineLimit(3...8)
                                .font(AppFont.text(16)).foregroundColor(p.ink)
                                .padding(.bottom, 10).overlay(alignment: .bottom) { Rule() }
                        }
                        ErrorText(text: error)
                        HStack(spacing: 20) {
                            Button(busy ? "Отправляем…" : "Создать") { Task { await create() } }.buttonStyle(.primary).disabled(busy)
                            if !tickets.isEmpty { Button("Отмена") { creating = false }.buttonStyle(.bracket) }
                        }
                    }
                }
            }
            .task {
                // Метка «● НОВЫЙ ОТВЕТ» появляется без обновления экрана.
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 10_000_000_000)
                    if phase == .active { await load() }
                }
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

    private func prefill() {
        guard let topic, subject.isEmpty else { return }
        if topic == "verification" { subject = "Верификация отклонена" }
        if topic.hasPrefix("order:"), let id = Int64(topic.dropFirst(6)) { subject = "Проблема с заказом № \(Fmt.pad(id))" }
        creating = !subject.isEmpty
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
                    if t.last_from_staff.bool { Text("● НОВЫЙ ОТВЕТ").bold().foregroundColor(p.ink) }
                } else {
                    Text("\(Fmt.ddmm(t.closed_at.date ?? t.updated_at.date)) · РЕШЕНО").foregroundColor(p.inkSoft)
                }
            }
            .font(AppFont.mono(11)).em(0.02, 11)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    private func create() async {
        guard !subject.trimmingCharacters(in: .whitespaces).isEmpty, !first.trimmingCharacters(in: .whitespaces).isEmpty else {
            error = "Заполните тему и сообщение"
            return
        }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let r = try await API.shared.post("support/tickets", ["subject": subject.trimmingCharacters(in: .whitespaces), "first_message": first.trimmingCharacters(in: .whitespaces)])
            subject = ""
            first = ""
            creating = false
            await load()
            session.push(.supportChat(r["id"].id))
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func load() async {
        tickets = (try? await API.shared.get("support/overview"))?.array ?? []
    }
}

/// Переписка по обращению: свои сообщения справа, ответы поддержки — красным слева.
struct SupportChatView: View {
    @Environment(\.palette) private var p
    @Environment(\.scenePhase) private var phase
    let ticketID: Int64

    @State private var ticket: JSON = .null
    @State private var thread: [JSON] = []
    @State private var text = ""
    @State private var busy = false
    @State private var error: String?

    private var open: Bool { ["open", "in_progress"].contains(ticket.status.str) }

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
                Rule2()
                if open {
                    HStack(spacing: 12) {
                        TextField("", text: $text, prompt: Text("Введите сообщение…").foregroundColor(p.inkFaint), axis: .vertical)
                            .lineLimit(1...5).font(AppFont.text(16)).foregroundColor(p.ink)
                        MonoLink(text: busy ? "…" : "Отправить →", bold: true, color: text.trimmingCharacters(in: .whitespaces).isEmpty ? p.inkSoft : p.ink) {
                            Task { await send() }
                        }
                        .disabled(busy || text.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                    .padding(.bottom, 12)
                    .overlay(alignment: .bottom) { Rectangle().fill(p.ink).frame(height: 1) }
                    ErrorText(text: error)
                    Button("Вопрос решён — закрыть") { Task { await close() } }.buttonStyle(.bracket).frame(maxWidth: .infinity).disabled(busy)
                } else if !ticket.isNull {
                    Text("Обращение закрыто. Если вопрос остался — напишите новое.").font(AppFont.text(14)).foregroundColor(p.inkSoft)
                }
            }
            .onChange(of: thread.count) { _ in withAnimation { proxy.scrollTo("bottom") } }
        }
        .task {
            await load()
            // Живой чат: пока экран открыт и приложение активно — подтягиваем ответы каждые 4 секунды.
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 4_000_000_000)
                if phase == .active { await load() }
            }
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
