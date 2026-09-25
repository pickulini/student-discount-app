import SwiftUI

/// Кошелёк (макет 40): баланс, бонусы, пополнение через СБП, последние операции.
struct WalletView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session

    @State private var wallet: JSON?
    @State private var ops: [JSON]?
    @State private var totalSaved: Double?
    @State private var preset: Int = 500
    @State private var custom = ""
    @State private var allOps = false
    @State private var busy = false
    @State private var error: String?
    @State private var payURL: URL?

    private var amount: Int { preset == 0 ? Int(custom.filter(\.isNumber)) ?? 0 : preset }

    var body: some View {
        Screen(spacing: 20, onRefresh: load) {
            TabHeader()
        } content: {
            Text("КОШЕЛЁК").font(AppFont.display(34)).em(-0.02, 34).foregroundColor(p.ink)
            if let wallet {
                SectionLabel("Денежный баланс", color: p.inkSoft)
                Text(Fmt.rub(wallet.balance.num)).font(AppFont.display(48)).em(-0.03, 48).foregroundColor(p.ink).lineLimit(1).minimumScaleFactor(0.5)
                Leader(label: "Бонусные баллы", value: "\(Fmt.num(wallet.bonus.num)) Б", valueBold: true)
                Text("1 балл = 1 ₽. Бонусами можно оплатить часть заказа — лимит указан в каждом предложении.")
                    .font(AppFont.text(14)).foregroundColor(p.inkSoft)
                Rule2()
                HStack {
                    SectionLabel("Пополнить")
                    Spacer()
                    Meta("Через СБП")
                }
                ChipTabs(items: [(300, "300"), (500, "500"), (1000, "1 000"), (2000, "2 000"), (0, "Другая")], value: $preset, scroll: true)
                VStack(alignment: .leading, spacing: 8) {
                    Text("СУММА").font(AppFont.mono(11, .medium)).em(0.06, 11).foregroundColor(p.inkSoft)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        if preset == 0 {
                            TextField("", text: $custom, prompt: Text("0").foregroundColor(p.inkFaint))
                                .keyboardType(.numberPad)
                                .font(AppFont.display(28)).foregroundColor(p.ink)
                                .fixedSize()
                            Text("₽").font(AppFont.display(28)).foregroundColor(p.ink)
                        } else {
                            Text(Fmt.rub(Double(amount))).font(AppFont.display(28)).foregroundColor(p.ink)
                        }
                        Spacer()
                    }
                    .padding(.bottom, 10)
                    .overlay(alignment: .bottom) { Rectangle().fill(p.ink).frame(height: 1) }
                }
                ErrorText(text: error)
                Button(busy ? "Переходим к оплате…" : "Пополнить на \(Fmt.rub(Double(amount)))") { Task { await topUp() } }
                    .buttonStyle(.primary).disabled(busy || amount < 10 || amount > 100_000)
                Rule2()
                HStack {
                    SectionLabel("Последние операции")
                    Spacer()
                    if (ops?.count ?? 0) > 4 {
                        Button { withAnimation { allOps.toggle() } } label: { Meta(allOps ? "Свернуть ↑" : "Все →") }.buttonStyle(.plain)
                    }
                }
                VStack(spacing: 14) {
                    if let ops {
                        if ops.isEmpty {
                            Text("В этом месяце операций не было.").font(AppFont.text(13)).foregroundColor(p.inkSoft).frame(maxWidth: .infinity, alignment: .leading)
                        }
                        ForEach(Array((allOps ? ops : Array(ops.prefix(4))).enumerated()), id: \.offset) { _, o in
                            let line = OrderLine(date: o.created_at.date, title: o.title.str.components(separatedBy: " · ").first ?? "",
                                                 value: Fmt.signed(o.amount.num, unit: o.unit.str == "BONUS" ? "Б" : "₽"))
                            if let oid = o.order_id.int64 {
                                Button { session.push(.order(oid)) } label: { line }.buttonStyle(.plain)
                            } else {
                                line
                            }
                        }
                    } else {
                        Meta("Загружаем…").frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                Rule()
                VStack(spacing: 0) {
                    Button { session.push(.savings) } label: {
                        NavRow(title: "Журнал экономии", sub: totalSaved.map { "\(Fmt.rub($0)) за всё время" } ?? "…")
                    }
                    .buttonStyle(.plain)
                    Button { session.push(.referral) } label: {
                        NavRow(title: "Пригласить друзей", sub: "+100 бонусов за каждого")
                    }
                    .buttonStyle(.plain)
                }
            } else {
                LoadingView(label: "Открываем кошелёк…").frame(height: 300)
            }
        }
        .task { if wallet == nil { await load() } }
        .sheet(item: $payURL, onDismiss: { Task { await load() } }) { SafariView(url: $0).ignoresSafeArea() }
    }

    private func load() async {
        async let w = try? API.shared.get("wallet")
        async let o = try? API.shared.get("wallet/operations")
        async let r = try? API.shared.get("orders")
        wallet = await w ?? JSON.object(["balance": .number(0), "bonus": .number(0)])
        ops = (await o)?.operations.array ?? []
        let orders = (await r)?.array ?? []
        totalSaved = orders.filter(OrderMath.spent).reduce(0) { $0 + OrderMath.saved($1) }
    }

    private func topUp() async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            let r = try await API.shared.post("payments/init", ["amount": amount])
            if let u = URL(string: r.payment_url.str) { payURL = u }
        } catch {
            self.error = "Не удалось начать оплату через СБП"
        }
    }
}

/// Рефералы (макет 41): код, ссылка, статистика, приглашённые.
struct ReferralView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    @State private var code: String?
    @State private var stats: JSON = .null
    @State private var invitees: [JSON] = []
    @State private var copied = ""

    var body: some View {
        if let code {
            let link = "\(AppConfig.server)/r/\(code)"
            let short = link.replacingOccurrences(of: "https://", with: "").replacingOccurrences(of: "http://", with: "")
            let earned = invitees.filter { $0.reward_status.str == "credited" }.reduce(0) { $0 + $1.reward_amount.num }
            Screen(spacing: 20) {
                BackHeader("Кошелёк")
            } content: {
                VStack(alignment: .leading, spacing: 10) {
                    Text("ПРИГЛАШАЙ ДРУЗЕЙ").font(AppFont.display(30)).em(-0.02, 30).foregroundColor(p.ink).fixedSize(horizontal: false, vertical: true)
                    Text("Друг регистрируется по вашей ссылке и проходит верификацию — вы оба получаете по 100 бонусов.")
                        .font(AppFont.text(14)).foregroundColor(p.inkSoft)
                }
                Rule2()
                VStack(spacing: 16) {
                    SectionLabel("Ваш код", color: p.inkSoft)
                    Text(code.uppercased()).font(AppFont.display(40)).em(0.01, 40).foregroundColor(p.ink).lineLimit(1).minimumScaleFactor(0.5)
                    Button(copied == "code" ? "✓ Скопировано" : "Копировать код") { copy(code, "code") }.buttonStyle(.bracket)
                }
                .frame(maxWidth: .infinity)
                Rule()
                HStack {
                    Text(short).font(AppFont.mono(13)).foregroundColor(p.ink).lineLimit(1)
                    Spacer()
                    MonoLink(text: copied == "link" ? "✓ Скопировано" : "Копировать", bold: true) { copy(link, "link") }
                }
                Rule()
                ShareLink(item: URL(string: link)!, message: Text("Скидки для студентов — регистрируйся по моей ссылке, получим по 100 бонусов:")) {
                    Text("ПОДЕЛИТЬСЯ ССЫЛКОЙ").font(AppFont.mono(12, .bold)).em(0.06, 12).foregroundColor(p.onInk)
                        .frame(maxWidth: .infinity).padding(.vertical, 15).background(p.ink)
                }
                Rule2()
                HStack(spacing: 16) {
                    StatCell(value: Fmt.num(stats.total_invites.double ?? Double(invitees.count)), label: "Приглашено")
                    VRule().frame(height: 44)
                    StatCell(value: Fmt.num(stats.active.double ?? Double(invitees.filter { $0.verified.bool }.count)), label: "Активных")
                    VRule().frame(height: 44)
                    StatCell(value: "\(Fmt.num(earned > 0 ? earned : stats.bonus_total.num)) Б", label: "Заработано", accent: true)
                }
                Rule2()
                SectionLabel("Приглашённые")
                if invitees.isEmpty {
                    Text("Пока никого. Отправьте ссылку другу — он появится здесь сразу после регистрации.").font(AppFont.text(14)).foregroundColor(p.inkSoft)
                }
                ForEach(Array(invitees.enumerated()), id: \.offset) { _, i in
                    PersonRow(user: i, meta: [i.username.string.map { "@\($0)" }, i.university.string].compactMap { $0 }.joined(separator: " · ")) {
                        Text(rewardLabel(i)).font(AppFont.mono(i.reward_status.str == "credited" ? 12 : 11, i.reward_status.str == "credited" ? .bold : .regular))
                            .foregroundColor(i.reward_status.str == "credited" ? p.ink : p.inkSoft)
                    }
                }
            }
        } else {
            LoadingScreen("Загружаем приглашения…") { BackHeader("Кошелёк") }.task { await load() }
        }
    }

    private func rewardLabel(_ i: JSON) -> String {
        switch i.reward_status.str {
        case "credited": return "+\(Fmt.num(i.reward_amount.num)) Б"
        case "pending": return "+\(Fmt.num(i.reward_amount.num)) Б" + (i.available_at.date.map { " · \(Fmt.ddmm($0))" } ?? "")
        case "cancelled": return "ОТМЕНЁН"
        default: return i.verified.bool ? "НАЧИСЛЯЕМ" : "ЖДЁТ ВЕРИФ."
        }
    }

    private func copy(_ s: String, _ what: String) {
        UIPasteboard.general.string = s
        copied = what
        Task { try? await Task.sleep(nanoseconds: 1_600_000_000); copied = "" }
    }

    private func load() async {
        async let c = try? API.shared.get("referral/code")
        async let s = try? API.shared.get("referral/stats")
        async let i = try? API.shared.get("referral/invitees")
        code = (await c)?.code.string ?? ""
        stats = await s ?? .null
        invitees = (await i)?.array ?? []
    }
}

/// Человек в списке: аватар, имя, моно-строка, справа — своё.
struct PersonRow<Right: View>: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    let user: JSON
    var meta: String = ""
    var sub: String? = nil
    var size: CGFloat = 40
    let right: Right

    init(user: JSON, meta: String = "", sub: String? = nil, size: CGFloat = 40, @ViewBuilder right: () -> Right) {
        self.user = user
        self.meta = meta
        self.sub = sub
        self.size = size
        self.right = right()
    }

    var body: some View {
        HStack(spacing: 14) {
            Button {
                if let u = user.username.string, !u.isEmpty { session.push(.user(u)) }
            } label: {
                HStack(spacing: 14) {
                    Avatar(url: user.avatar_url.string, name: user.full_name.str, size: size)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(user.full_name.str).font(AppFont.text(16, .semibold)).foregroundColor(p.ink).lineLimit(1)
                        if !meta.isEmpty { Text(meta).font(AppFont.mono(11)).em(0.02, 11).foregroundColor(p.inkSoft).lineLimit(1) }
                        if let sub, !sub.isEmpty { Text(sub).font(AppFont.text(13)).foregroundColor(p.inkSoft).lineLimit(1) }
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            right
        }
    }
}
