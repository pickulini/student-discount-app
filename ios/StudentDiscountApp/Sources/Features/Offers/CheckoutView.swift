import SwiftUI
import WebKit

/// Оплата (макеты 20 и 21). Заказ создаётся в момент нажатия «Оплатить»:
/// деньги списываются с кошелька, затем показываем чек.
struct CheckoutView: View {
    @Environment(\.palette) private var p
    @EnvironmentObject private var session: Session
    let offerID: Int64
    var startWithSBP = false

    @State private var offer: JSON?
    @State private var wallet: JSON?
    @State private var bonus: Double?
    @State private var method = "wallet"
    @State private var busy = false
    @State private var error: String?
    @State private var payURL: URL?

    var body: some View {
        if let offer, let wallet, let bonus {
            content(offer, wallet, bonus)
                .sheet(item: $payURL, onDismiss: { Task { await load() } }) { PaymentSheet(url: $0) }
        } else {
            LoadingScreen("Готовим оплату…") { BackHeader { HeaderMeta("Новый заказ") } }
                .task {
                    method = startWithSBP ? "sbp" : "wallet"
                    await load()
                }
        }
    }

    private func steps(_ max: Double) -> [Double] {
        guard max > 0 else { return [0] }
        var s: Set<Double> = [0, max]
        for f in [1.0 / 3, 2.0 / 3] {
            let v = (max * f).rounded()
            if v > 0 && v < max { s.insert(v) }
        }
        return s.sorted()
    }

    @ViewBuilder
    private func content(_ offer: JSON, _ wallet: JSON, _ bonus: Double) -> some View {
        let name = offer.company_name.string ?? offer.title.str
        let base = offer.base_price.num
        let discount = offer.discount_type.str == "percentage" ? base * offer.discount_value.num / 100 : min(base, offer.discount_value.num)
        let after = max(0, base - discount)
        let maxBonus = OfferMath.maxBonus(offer, available: wallet.bonus.num)
        let total = max(0, after - bonus)
        let balance = wallet.balance.num
        let shortage = max(0, (total - balance).rounded(.up))
        let noMoney = method == "wallet" && shortage > 0
        let pct = offer.discount_type.str == "percentage" ? " \(Fmt.num(offer.discount_value.num))%" : ""

        Screen(spacing: 24) {
            BackHeader { HeaderMeta("Новый заказ") }
        } content: {
            Text("ОПЛАТА").font(AppFont.display(30)).em(-0.02, 30).foregroundColor(p.ink)
            VStack(alignment: .leading, spacing: 4) {
                Text(name.uppercased()).font(AppFont.display(18)).foregroundColor(p.ink)
                Text([offer.title.string, offer.address.string].compactMap { $0 }.joined(separator: " · "))
                    .font(AppFont.text(14)).foregroundColor(p.inkSoft)
            }
            Rule2()
            if !noMoney {
                VStack(spacing: 10) {
                    Leader(label: "Цена", value: Fmt.rub(base))
                    Leader(label: "Скидка студента\(pct)", value: "−\(Fmt.num(discount)) ₽", valueColor: p.accent)
                }
                if maxBonus > 0 {
                    Rule()
                    HStack {
                        SectionLabel("Списать бонусы")
                        Spacer()
                        Meta("Доступно \(Int(wallet.bonus.num))")
                    }
                    ChipTabs(items: steps(maxBonus).map { v in (v, v == maxBonus && v > 0 ? "\(Int(v)) · макс" : "\(Int(v))") },
                             value: Binding(get: { bonus }, set: { self.bonus = $0 }))
                    Leader(label: "Бонусы", value: bonus > 0 ? "−\(Int(bonus)) ₽" : "0 ₽")
                }
                Rule2()
            }
            HStack(alignment: .lastTextBaseline, spacing: 8) {
                Text("ИТОГО К ОПЛАТЕ").font(AppFont.mono(12, .bold)).em(0.03, 12).foregroundColor(p.ink).fixedSize()
                DashLine().stroke(p.inkFaint, style: StrokeStyle(lineWidth: 1, dash: [3, 3])).frame(height: 1)
                Text(Fmt.rub(total)).font(AppFont.display(30)).foregroundColor(p.ink).fixedSize()
            }
            Rule2()
            if noMoney {
                AlertBlock(title: "Недостаточно средств",
                           text: "На кошельке \(Fmt.rub(balance)), а нужно \(Fmt.rub(total)). Пополните кошелёк или оплатите через СБП.")
            }
            SectionLabel("Способ оплаты")
            VStack(spacing: 14) {
                methodRow("wallet", "Кошелёк", shortage > 0 ? "Не хватает \(Fmt.rub(shortage))" : "Списание с баланса, мгновенно", Fmt.rub(balance))
                methodRow("sbp", "СБП", "Через приложение вашего банка", nil)
            }
            ErrorText(text: error)
            if noMoney {
                Button("Пополнить на \(Fmt.rub(shortage))") { Task { await topUp(shortage) } }.buttonStyle(.primary).disabled(busy)
                Button("Оплатить через СБП") { Task { await topUp(shortage) } }.buttonStyle(.bracket).frame(maxWidth: .infinity).disabled(busy)
            } else {
                Button(busy ? "Оплачиваем…" : "Оплатить \(Fmt.rub(total))") { Task { await pay(offer, bonus: bonus, total: total, shortage: shortage) } }
                    .buttonStyle(.primary).disabled(busy)
                Text("После оплаты вы получите чек с кодом — покажите его на кассе. Код действует до конца дня.")
                    .font(AppFont.text(13)).foregroundColor(p.inkSoft).multilineTextAlignment(.center).frame(maxWidth: .infinity)
            }
        }
    }

    private func methodRow(_ key: String, _ label: String, _ hint: String, _ right: String?) -> some View {
        Button { method = key } label: {
            HStack(alignment: .top, spacing: 12) {
                Text(method == key ? "[×]" : "[ ]").font(AppFont.mono(13, .bold)).foregroundColor(method == key ? p.ink : p.inkFaint).frame(width: 26, alignment: .leading)
                VStack(alignment: .leading, spacing: 3) {
                    Text(label.uppercased()).font(AppFont.mono(12, method == key ? .bold : .regular)).em(0.04, 12)
                        .foregroundColor(method == key ? p.ink : p.inkSoft)
                    Text(hint).font(AppFont.text(14)).foregroundColor(p.inkSoft)
                }
                Spacer()
                if let right { Text(right).font(AppFont.mono(12)).foregroundColor(p.ink) }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func load() async {
        async let o = try? API.shared.get("offers/\(offerID)")
        async let w = try? API.shared.get("wallet")
        let od = await o
        let wd = await w
        offer = od?.offer ?? offer ?? .null
        wallet = wd ?? JSON.object(["balance": .number(0), "bonus": .number(0)])
        if bonus == nil, let offer, let wallet { bonus = OfferMath.maxBonus(offer, available: wallet.bonus.num) }
    }

    private func topUp(_ amount: Double) async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            let r = try await API.shared.post("payments/init", ["amount": max(1, amount), "return_to": "/offers/\(offerID)/checkout"])
            if let u = URL(string: r.payment_url.str) { payURL = u }
        } catch {
            self.error = "Не удалось начать оплату через СБП"
        }
    }

    private func pay(_ offer: JSON, bonus: Double, total: Double, shortage: Double) async {
        if method == "sbp" { return await topUp(max(1, shortage > 0 ? shortage : total.rounded(.up))) }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let r = try await API.shared.post("orders", ["offer_id": offerID, "bonus_points": Int(bonus)])
            let oid = r["id"].id
            try await API.shared.post("orders/\(oid)/confirm")
            // Вместо оплаты — чек: подменяем текущий экран.
            var path = session.paths[session.tab] ?? NavigationPath()
            if !path.isEmpty { path.removeLast() }
            path.append(Route.order(oid))
            session.paths[session.tab] = path
        } catch let e as APIError {
            error = e.localizedDescription.contains("Недостаточно") ? "Недостаточно средств на кошельке." : "Ошибка: \(e.localizedDescription)"
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

/// Окно оплаты СБП. Страница оплаты открывается во встроенном WebView; как только
/// платёж подтверждён (или отменён), окно закрывается само и экран обновляет баланс.
/// Вход на сайт здесь не нужен: страницу защищает токен в ссылке.
struct PaymentSheet: View {
    @Environment(\.palette) private var p
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dismiss) private var dismiss
    let url: URL
    @State private var loading = true

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                MonoLink(text: "× Закрыть") { dismiss() }
                Spacer()
                HeaderMeta("Оплата · СБП")
            }
            .padding(.horizontal, 20).padding(.vertical, 16)
            ZStack {
                PaymentWebView(url: themed(url), loading: $loading) { dismiss() }
                if loading { LoadingView() }
            }
        }
        .background((scheme == .dark ? Palette.dark.desk : Palette.light.desk).ignoresSafeArea())
    }

    private func themed(_ u: URL) -> URL {
        guard var c = URLComponents(url: u, resolvingAgainstBaseURL: false) else { return u }
        let items = c.queryItems ?? []
        c.queryItems = items + [URLQueryItem(name: "theme", value: scheme == .dark ? "dark" : "light")]
        return c.url ?? u
    }
}

struct PaymentWebView: UIViewRepresentable {
    let url: URL
    @Binding var loading: Bool
    let onFinish: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .nonPersistent()
        let v = WKWebView(frame: .zero, configuration: cfg)
        v.navigationDelegate = context.coordinator
        v.isOpaque = false
        v.backgroundColor = .clear
        v.load(URLRequest(url: url))
        return v
    }

    func updateUIView(_ v: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        let parent: PaymentWebView
        private var finished = false
        init(_ p: PaymentWebView) { parent = p }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            let path = action.request.url?.path ?? ""
            // Всё, что уходит со страницы оплаты (отмена → /wallet, «Продолжить» и т.п.), — закрываем окно.
            if path.hasPrefix("/payments/sbp/checkout") || path.hasPrefix("/payments/sbp/done") || action.request.url?.scheme == "about" {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
                finish()
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.loading = false
            #if DEBUG
            if UserDefaults.standard.bool(forKey: "uitest_autoconfirm"), webView.url?.path.hasPrefix("/payments/sbp/checkout") == true {
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) { webView.evaluateJavaScript("document.querySelector('form')?.submit()") }
            }
            #endif
            // «Оплачено» показываем секунду и закрываемся сами.
            if webView.url?.path.hasPrefix("/payments/sbp/done") == true {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { self.finish() }
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { parent.loading = false }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { parent.loading = false }

        private func finish() {
            guard !finished else { return }
            finished = true
            parent.onFinish()
        }
    }
}
