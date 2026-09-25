import SwiftUI

/// Предложить ивент (макет 32).
struct EventFormView: View {
    @Environment(\.palette) private var p
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var session: Session

    @State private var title = ""
    @State private var details = ""
    @State private var start = Calendar.current.date(bySettingHour: 19, minute: 0, second: 0, of: Date().addingTimeInterval(86400)) ?? Date()
    @State private var hasEnd = false
    @State private var end = Date().addingTimeInterval(86400 + 7200)
    @State private var address = ""
    @State private var price = ""
    @State private var maxUses = ""
    @State private var recurrence = ""
    @State private var privacy = "public"
    @State private var companies: [JSON] = []
    @State private var company: Int64? = nil
    @State private var cover = ""
    @State private var busy = ""
    @State private var error: String?

    private let recurrences: [(String, String)] = [("", "Нет"), ("FREQ=DAILY", "Каждый день"), ("FREQ=WEEKLY", "Неделя"), ("FREQ=MONTHLY", "Месяц")]

    var body: some View {
        Screen(spacing: 22) {
            BackHeader("Отмена", mark: "×") {
                MonoLink(text: busy == "draft" ? "Сохраняем…" : "Черновик") { submit(send: false) }.disabled(!busy.isEmpty)
            }
        } content: {
            VStack(alignment: .leading, spacing: 10) {
                Text("ПРЕДЛОЖИТЬ ИВЕНТ").font(AppFont.display(30)).em(-0.02, 30).foregroundColor(p.ink).fixedSize(horizontal: false, vertical: true)
                Text("После модерации ивент появится в ленте.").font(AppFont.text(14)).foregroundColor(p.inkSoft)
            }
            Rule2()
            UnderlineField(label: "Название *", text: $title, placeholder: "Встреча студентов МГУ")
            UnderlineField(label: "Описание", text: $details, placeholder: "Что будет, для кого, программа…")
            HStack(alignment: .top, spacing: 20) {
                dateField("Начало *", $start)
                VStack(alignment: .leading, spacing: 8) {
                    fieldLabel("Окончание")
                    if hasEnd {
                        DatePicker("", selection: $end, in: start..., displayedComponents: [.date, .hourAndMinute]).labelsHidden()
                            .environment(\.locale, Locale(identifier: "ru_RU"))
                    } else {
                        Button { hasEnd = true; end = start.addingTimeInterval(7200) } label: {
                            Text("—").font(AppFont.mono(16)).foregroundColor(p.inkFaint).frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                    }
                    Rule()
                }
            }
            UnderlineField(label: "Место", text: $address, placeholder: "г. Москва, Ленинские горы, 1")
            HStack(alignment: .top, spacing: 20) {
                UnderlineField(label: "Цена билета", text: $price, placeholder: "0 ₽", mono: true, hint: "0 = бесплатно", keyboard: .decimalPad)
                UnderlineField(label: "Макс. мест", text: $maxUses, placeholder: "без ограничений", keyboard: .numberPad)
            }
            Rule()
            SectionLabel("Повторение")
            ChipTabs(items: recurrences, value: $recurrence, scroll: true)
            Rule()
            SectionLabel("Кто может видеть")
            VStack(alignment: .leading, spacing: 14) {
                CheckRow(title: "Все пользователи", checked: privacy == "public") { privacy = "public" }
                CheckRow(title: "Студенты моего вуза", sub: session.user.university_id.isNull ? "Вуз не указан" : nil, checked: privacy == "university",
                         action: session.user.university_id.isNull ? nil : { privacy = "university" })
                CheckRow(title: "Подписчики компании", sub: company == nil ? "Только для ивентов компании" : nil, checked: privacy == "subscribers",
                         action: company == nil ? nil : { privacy = "subscribers" })
                CheckRow(title: "Только мои друзья", checked: privacy == "friends") { privacy = "friends" }
                CheckRow(title: "Только по приглашению", checked: privacy == "invite_only") { privacy = "invite_only" }
            }
            Rule()
            PhotoUploadBox(title: "Обложка", hint: "JPG, 1600×900", uploadedURL: $cover)
            if !companies.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    HStack { fieldLabel("Компания"); Spacer(); Meta("Необяз.") }
                    Menu {
                        Button("— Личный ивент —") { company = nil; if privacy == "subscribers" { privacy = "public" } }
                        ForEach(companies) { c in Button(c.name.str) { company = c["id"].id } }
                    } label: {
                        HStack {
                            Text(companies.first { $0["id"].id == company }?.name.string ?? "— Личный ивент —").font(AppFont.text(16)).foregroundColor(p.ink)
                            Spacer()
                            Text("↓").font(AppFont.mono(11, .bold)).foregroundColor(p.ink)
                        }
                        .padding(.bottom, 10).overlay(alignment: .bottom) { Rule() }
                    }
                }
            }
            ErrorText(text: error)
            Button(busy == "send" ? "Отправляем…" : "Отправить на модерацию") { submit(send: true) }
                .buttonStyle(.primary).disabled(!busy.isEmpty)
        }
        .task {
            if session.user.role.str == "merchant", let r = try? await API.shared.get("merchant/companies") { companies = r.array }
        }
    }

    private func fieldLabel(_ s: String) -> some View {
        Text(s.uppercased()).font(AppFont.mono(11, .medium)).em(0.06, 11).foregroundColor(p.inkSoft)
    }

    private func dateField(_ label: String, _ value: Binding<Date>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            fieldLabel(label)
            DatePicker("", selection: value, in: Date()..., displayedComponents: [.date, .hourAndMinute]).labelsHidden()
                .environment(\.locale, Locale(identifier: "ru_RU"))
            Rule()
        }
    }

    private func submit(send: Bool) {
        error = nil
        guard !title.trimmingCharacters(in: .whitespaces).isEmpty else { error = "Укажите название"; return }
        if hasEnd && end <= start { error = "Окончание должно быть позже начала"; return }
        Task {
            busy = send ? "send" : "draft"
            defer { busy = "" }
            let iso = ISO8601DateFormatter()
            var body: [String: Any] = [
                "title": title.trimmingCharacters(in: .whitespaces),
                "description": details.trimmingCharacters(in: .whitespaces),
                "start_at": iso.string(from: start),
                "end_at": hasEnd ? iso.string(from: end) : "",
                "event_privacy": privacy,
            ]
            if !address.isEmpty { body["address"] = address.trimmingCharacters(in: .whitespaces) }
            if !cover.isEmpty { body["image_url"] = cover }
            if let company { body["company_id"] = company }
            if privacy == "university", let u = session.user.university_id.int64 { body["event_university_id"] = u }
            if let v = Double(price.replacingOccurrences(of: ",", with: ".")), v > 0 { body["special_price"] = v }
            if let m = Int(maxUses), m > 0 { body["max_uses"] = m }
            if !recurrence.isEmpty { body["recurrence_rule"] = recurrence }
            do {
                let r = try await API.shared.post("events", body)
                if send { try await API.shared.post("events/\(r["id"].id)/submit") }
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
