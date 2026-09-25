import SwiftUI

/// Верификация (макеты 12 и 13): форма, если заявок не было, её отклонили или срок
/// истёк; иначе — статус заявки.
struct VerificationView: View {
    @EnvironmentObject private var session: Session
    var afterRegister = false
    @State private var last: JSON?
    @State private var loaded = false

    private var showForm: Bool {
        guard session.user.student_status.str != "verified" else { return false }
        guard let last, !last.isNull else { return true }
        return ["rejected", "expired"].contains(last.status.str) || session.user.student_status.str == "expired"
    }

    var body: some View {
        Group {
            if !loaded {
                LoadingScreen("Проверяем статус…") { BackHeader("Назад") }
            } else if showForm {
                VerificationForm(last: last ?? .null, afterRegister: afterRegister) { await load(); await session.refreshUser() }
            } else {
                VerificationStatus(last: last ?? .null)
            }
        }
        .task { await load() }
    }

    private func load() async {
        let r = try? await API.shared.get("students/verify")
        last = r?.verification
        loaded = true
    }
}

private struct VerificationForm: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    let last: JSON
    let afterRegister: Bool
    let onSent: () async -> Void

    @State private var universities: [JSON] = []
    @State private var uni: Int64? = nil
    @State private var otherUni = false
    @State private var uniName = ""
    @State private var number = ""
    @State private var doc = ""
    @State private var selfie = ""
    @State private var busy = false
    @State private var error: String?

    private var rejected: Bool { last.status.str == "rejected" }
    private var expired: Bool { session.user.student_status.str == "expired" || last.status.str == "expired" }
    private var ready: Bool {
        (uni != nil && !otherUni || !uniName.trimmingCharacters(in: .whitespaces).isEmpty)
            && !number.trimmingCharacters(in: .whitespaces).isEmpty && !doc.isEmpty && !selfie.isEmpty
    }

    var body: some View {
        Screen(spacing: 24) {
            BackHeader(afterRegister ? "На главную" : "Назад", action: afterRegister ? { session.popToRoot() } : nil) {
                HeaderMeta("Шаг 2 из 2")
            }
        } content: {
            VStack(alignment: .leading, spacing: 10) {
                Text("ВЕРИФИКАЦИЯ").font(AppFont.display(30)).em(-0.02, 30).foregroundColor(p.ink)
                Text("Подтвердите, что вы студент, — откроются все скидки. Проверка занимает до 24 часов.")
                    .font(AppFont.text(16)).foregroundColor(p.inkSoft)
            }
            Leader(label: "Статус", value: expired ? "ВЕРИФИКАЦИЯ ИСТЕКЛА" : rejected ? "ЗАЯВКА ОТКЛОНЕНА" : "НЕ ВЕРИФИЦИРОВАН", valueBold: true)
            if rejected {
                AlertBlock(title: "Заявка отклонена",
                           text: (last.rejection_reason.string.map { $0.trimmingCharacters(in: CharacterSet(charactersIn: ".")) + ". " } ?? "") + "Загрузите снимки заново.")
                Text("Не согласны с решением или что-то непонятно?").font(AppFont.text(14)).foregroundColor(p.inkSoft)
                Button("Обратиться в поддержку") { session.push(.support(topic: "verification")) }.buttonStyle(.outline)
            } else if expired {
                Text("Скидки для студентов приостановлены. Подтвердите статус на новый учебный год.")
                    .font(AppFont.text(14)).foregroundColor(p.inkSoft)
            }
            Rule2()

            VStack(alignment: .leading, spacing: 8) {
                Text("УНИВЕРСИТЕТ").font(AppFont.mono(11, .medium)).em(0.06, 11).foregroundColor(p.inkSoft)
                Menu {
                    ForEach(universities) { u in
                        Button(u.name.str) { uni = u.id; otherUni = false }
                    }
                    Button("Другой вуз…") { uni = nil; otherUni = true }
                } label: {
                    HStack {
                        Text(otherUni ? "Другой вуз" : universities.first { $0.id == uni }?.name.string ?? "Выберите вуз")
                            .font(AppFont.text(16)).foregroundColor(uni == nil && !otherUni ? p.inkFaint : p.ink)
                            .lineLimit(1)
                        Spacer()
                        Text("↓").font(AppFont.mono(11, .bold)).foregroundColor(p.ink)
                    }
                    .padding(.bottom, 10)
                    .overlay(alignment: .bottom) { Rule() }
                }
                if otherUni || universities.isEmpty {
                    UnderlineField(label: "Название вуза", text: $uniName, placeholder: "Полное название вуза")
                }
            }
            UnderlineField(label: "Номер студенческого", text: $number, placeholder: "12345/2024", mono: true, autocap: .never)
            Rule()
            PhotoUploadBox(title: "1. Фото студенческого", hint: "Разворот с фото и датой", uploadedURL: $doc)
            PhotoUploadBox(title: "2. Селфи со студенческим", hint: "Лицо и билет в кадре", uploadedURL: $selfie)
            ErrorText(text: error)
            Button(busy ? "Отправляем…" : "Отправить на проверку") { Task { await submit() } }
                .buttonStyle(.primary).disabled(!ready || busy)
            Text("Фото видят только модераторы.").font(AppFont.text(13)).foregroundColor(p.inkSoft).frame(maxWidth: .infinity)
            if afterRegister || last.isNull {
                Button("Пропустить — на главную") { session.popToRoot() }.buttonStyle(.outline)
            }
        }
        .task {
            if let r = try? await API.shared.get("universities") { universities = r.array }
            if let id = session.user.university_id.int64 { uni = id }
            if number.isEmpty { number = last.student_identifier.str }
        }
    }

    private func submit() async {
        busy = true
        error = nil
        defer { busy = false }
        var body: [String: Any] = [
            "student_identifier": number.trimmingCharacters(in: .whitespaces),
            "document_key": doc,
            "selfie_key": selfie,
            "university_name": otherUni || uni == nil ? uniName.trimmingCharacters(in: .whitespaces) : "",
        ]
        body["university_id"] = (otherUni ? nil : uni).map { NSNumber(value: $0) } ?? NSNull()
        do {
            try await API.shared.post("students/verify", body)
            await onSent()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct VerificationStatus: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    let last: JSON

    var body: some View {
        let verified = session.user.student_status.str == "verified" || last.status.str == "verified"
        let created = last.created_at.date
        let expires = session.user.student_verification_expires_at.date ?? last.expires_at.date
        Screen(spacing: 24) {
            BackHeader("Назад")
        } content: {
            VStack(spacing: 8) {
                if !last.isNull { Meta("Заявка № \(String(Fmt.pad(last["id"].id).suffix(5)))") }
                Text(verified ? "ВЕРИФИЦИРОВАН" : "НА ПРОВЕРКЕ").font(AppFont.display(26)).em(-0.02, 26).foregroundColor(p.ink)
                if let created { Meta("Отправлено \(Fmt.ddmmyy(created)) · \(Fmt.hhmm(created))") }
            }
            .frame(maxWidth: .infinity)
            Rule2()
            VStack(alignment: .leading, spacing: 16) {
                let stamp = created.map { "\(Fmt.ddmm($0)) · \(Fmt.hhmm($0))" }
                CheckRow(title: "Документы загружены", sub: stamp, checked: true)
                CheckRow(title: "Заявка отправлена", sub: stamp, checked: true)
                CheckRow(title: "Проверка модератором",
                         sub: verified ? last.verified_at.date.map { "\(Fmt.ddmm($0)) · \(Fmt.hhmm($0))" } : "обычно до 24 ч",
                         checked: verified)
                CheckRow(title: "Все скидки открыты", checked: verified)
            }
            Button(verified ? "К скидкам" : "На главную") { session.open(.home) }.buttonStyle(.primary)
            SectionLabel("Заявка")
            VStack(spacing: 10) {
                if verified, let expires { Leader(label: "Верифицирован", value: "✓ ДО \(Fmt.ddmmyy(expires))", valueBold: true) }
                Leader(label: "Университет", value: session.user.university_short.string ?? last.university_name.string ?? "—")
                if let n = last.student_identifier.string { Leader(label: "Номер студенческого", value: n) }
                Leader(label: "Фото студенческого", value: last.has_document.bool ? "✓" : "—")
                Leader(label: "Селфи", value: last.has_selfie.bool ? "✓" : "—")
            }
            Rule()
            Text(verified ? "Сменили вуз или данные изменились — напишите в поддержку, обновим заявку."
                          : "Ошиблись в данных или загрузили не то фото — напишите в поддержку, модератор увидит сообщение.")
                .font(AppFont.text(14)).foregroundColor(p.inkSoft)
            Button("Написать в поддержку") { session.push(.support(topic: nil)) }.buttonStyle(.bracket)
        }
    }
}
