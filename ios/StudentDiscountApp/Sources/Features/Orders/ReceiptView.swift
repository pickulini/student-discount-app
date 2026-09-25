import SwiftUI

/// Чек заказа (макет 03): бумажный чек на «столе», QR и код для кассы.
struct ReceiptView: View {
    @Environment(\.palette) private var p
    @Environment(\.openURL) private var openURL
    @Environment(\.colorScheme) private var scheme
    @EnvironmentObject private var session: Session
    let orderID: Int64

    @State private var order: JSON?
    @State private var offer: JSON = .null
    @State private var orders: [JSON] = []
    @State private var notFound = false

    var body: some View {
        Group {
            if notFound {
                Screen { header } content: { EmptyState(title: "Чек не найден") }
            } else if let order {
                receiptScreen(order)
            } else {
                LoadingScreen("Печатаем чек…") { header }
            }
        }
        .task { await load() }
    }

    private var header: some View {
        BackHeader("Закрыть", mark: "×", action: { session.popToRoot() }) {
            if let order {
                ShareLink(item: shareText(order)) {
                    Text("[ СОХРАНИТЬ ]").font(AppFont.mono(11, .medium)).em(0.04, 11).foregroundColor(p.ink)
                }
            }
        }
    }

    private func code(_ o: JSON) -> String { "\(Fmt.pad(o["id"].id % 10000, 4)) · \(o.redeem_code.str)" }

    private func shareText(_ o: JSON) -> String {
        let place = o.company_name.string ?? o.offer_title.str
        return "Чек № \(Fmt.pad(o["id"].id))\n\(place)\n\(o.offer_title.str)\nИтого: \(Fmt.rub(o.total_amount.num))\nКод для кассы: \(code(o))"
    }

    @ViewBuilder
    private func receiptScreen(_ o: JSON) -> some View {
        let place = o.company_name.string ?? o.offer_title.str
        let addr = o.offer_address.string ?? offer.address.string
        ScrollView {
            VStack(spacing: 24) {
                header.padding(.horizontal, 20).padding(.top, 20)
                VStack(spacing: 0) {
                    paper(o, place: place, addr: addr)
                        .paperPalette()
                    PaperTear(color: scheme == .dark ? Color(hex: 0xE2D5B7) : .white)
                }
                .padding(.horizontal, 20)
                VStack(spacing: 20) {
                    Button("Проложить маршрут") { route(place: place, addr: addr) }.buttonStyle(.primary)
                    Button("Все мои чеки") { session.push(.orders) }.buttonStyle(.bracket)
                    Button("Проблема с заказом") { session.push(.support(topic: "order:\(o["id"].id)")) }.buttonStyle(.bracket(11))
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 28)
            }
        }
        .background(p.desk.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .refreshable { await load() }
    }

    private func paper(_ o: JSON, place: String, addr: String?) -> some View {
        PaperBody(order: o, offer: offer, orders: orders, place: place, addr: addr, code: code(o), user: session.user)
    }

    private func route(place: String, addr: String?) {
        var url: URL?
        if let lat = offer.latitude.double, let lng = offer.longitude.double, lat != 0 {
            url = URL(string: "https://yandex.ru/maps/?rtext=~\(lat),\(lng)&rtt=pd")
        } else if let q = (addr ?? place).addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            url = URL(string: "https://yandex.ru/maps/?text=\(q)")
        }
        if let url { openURL(url) }
    }

    private func load() async {
        do {
            let o = try await API.shared.get("orders/\(orderID)")
            order = o
            if let oid = o.offer_id.int64, let d = try? await API.shared.get("offers/\(oid)") { offer = d.offer }
        } catch {
            if order == nil { notFound = true }
        }
        orders = (try? await API.shared.get("orders"))?.array ?? orders
    }
}

/// Содержимое бумажного чека — со своей палитрой (в тёмной теме бумага остаётся бумагой).
private struct PaperBody: View {
    @Environment(\.palette) private var p
    let order: JSON
    let offer: JSON
    let orders: [JSON]
    let place: String
    let addr: String?
    let code: String
    let user: JSON

    var body: some View {
        let o = order
        let saved = o.discount_amount.num + o.bonus_amount.num
        let now = Date()
        let monthSaved = orders
            .filter { ["paid", "completed"].contains($0.status.str) }
            .filter { $0.created_at.date.map { Calendar.current.isDate($0, equalTo: now, toGranularity: .month) } ?? false }
            .reduce(0) { $0 + $1.discount_amount.num + $1.bonus_amount.num }
        let pct = offer.discount_type.str == "percentage" ? " \(Fmt.num(offer.discount_value.num))%" : ""
        let status: (String, Bool) = [
            "paid": ("✓ ОПЛАЧЕНО", true),
            "completed": ("✓ ПОГАШЕНО", false),
            "created": ("◐ ЖДЁТ ОПЛАТЫ", false),
            "refunded": ("↺ ВОЗВРАТ", false),
            "cancelled": ("✕ ОТМЕНЁН", false),
        ][o.status.str] ?? ("·", false)
        let name = user.full_name.str.split(separator: " ")
        let studentShort = name.count > 1 ? "\(name[0].prefix(1)). \(name.dropFirst().joined(separator: " "))" : user.full_name.str
        let active = ["paid", "completed"].contains(o.status.str)

        VStack(spacing: 14) {
            Text("СТУДЕНТ−%").font(AppFont.display(18)).foregroundColor(p.ink)
            Meta("Кассовый чек № \(Fmt.pad(o["id"].id))")
            Meta("\(Fmt.ddmmyy(o.created_at.date)) · \(Fmt.hhmm(o.created_at.date)) · Кошелёк")
            Rule2()
            Text(status.0 + (o.status.str == "completed" && o.redeemed_at.date != nil ? " \(Fmt.ddmm(o.redeemed_at.date)) \(Fmt.hhmm(o.redeemed_at.date))" : ""))
                .font(AppFont.mono(12, .bold)).em(0.04, 12).foregroundColor(status.1 ? p.accent : p.ink)
            VStack(spacing: 6) {
                Text(place.uppercased()).font(AppFont.display(24)).foregroundColor(p.ink).multilineTextAlignment(.center)
                if let addr { Text(addr).font(AppFont.text(14)).foregroundColor(p.inkSoft) }
            }
            .padding(.top, -6)
            Rule()
            VStack(spacing: 9) {
                Leader(label: o.offer_title.str, value: money2(o.subtotal.num))
                if o.discount_amount.num > 0 { Leader(label: "Скидка студента\(pct)", value: "−" + money2(o.discount_amount.num)) }
                if o.bonus_amount.num > 0 { Leader(label: "Бонусы", value: "−" + money2(o.bonus_amount.num)) }
            }
            Rule2()
            HStack(alignment: .lastTextBaseline, spacing: 8) {
                Text("ИТОГО").font(AppFont.mono(13, .bold)).em(0.03, 13).foregroundColor(p.ink)
                DashLine().stroke(p.inkFaint, style: StrokeStyle(lineWidth: 1, dash: [3, 3])).frame(height: 1)
                Text(Fmt.rub(o.total_amount.num)).font(AppFont.display(30)).foregroundColor(p.ink).fixedSize()
            }
            Rule()
            if saved > 0 {
                Meta("Вы сэкономили")
                Text(Fmt.rub(saved)).font(AppFont.display(42)).foregroundColor(p.accent).padding(.top, -4)
                Meta("За \(Fmt.monthsNom[Calendar.current.component(.month, from: now) - 1]) всего \(Fmt.rub(max(monthSaved, saved)))")
                Rule2()
            }
            if active {
                Text(o.status.str == "completed" ? "ЗАКАЗ ПОГАШЕН" : "ПОКАЖИТЕ НА КАССЕ").font(AppFont.mono(11, .bold)).em(0.06, 11).foregroundColor(p.ink)
                QRCode(text: code.replacingOccurrences(of: " · ", with: ""))
                    .frame(width: 170, height: 170)
                    .opacity(o.status.str == "completed" ? 0.25 : 1)
                Text("КОД \(code)").font(AppFont.mono(15, .bold)).em(0.08, 15).foregroundColor(p.ink)
            } else {
                Meta(o.status.str == "created" ? "Код появится после оплаты" : "Код больше не действует").padding(.vertical, 16)
            }
            Rule()
            if let until = offer.end_at.date { Meta("Действует до \(Fmt.ddmmyy(until))") }
            Meta((user.student_status.str == "verified" ? "Студент ✓" : "Студент") + (user.university_short.string.map { " \($0)" } ?? "") + " · " + studentShort)
            Barcode(seed: Int(o["id"].id), height: 26).frame(width: 240)
            Text("СПАСИБО! ПРИХОДИТЕ ЕЩЁ").font(AppFont.mono(11, .bold)).em(0.06, 11).foregroundColor(p.ink)
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 20).padding(.top, 28).padding(.bottom, 24)
        .background(p.bg)
    }

    private func money2(_ v: Double) -> String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.numberStyle = .decimal
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        f.groupingSeparator = "\u{00A0}"
        return f.string(from: NSNumber(value: v)) ?? "\(v)"
    }
}
