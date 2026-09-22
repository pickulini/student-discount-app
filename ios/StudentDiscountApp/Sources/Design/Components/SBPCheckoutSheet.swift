import SwiftUI
import WebKit

/// Экран эмуляции оплаты СБП: показывает страницу подтверждения, которую
/// отдаёт бэкенд (`/payments/sbp/checkout/{id}`), и распознаёт завершение
/// оплаты по редиректу на `/wallet`, который бэкенд делает после подтверждения.
/// Используется и для пополнения баланса, и (через тот же механизм) для
/// оплаты заказа — это единственный реальный способ оплаты, который есть
/// на бэкенде, поэтому именно он и показывается как "окошко с выбором оплаты".
struct SBPCheckoutSheet: View {
    let paymentURL: URL
    /// Вызывается один раз, когда бэкенд подтвердил оплату (редирект на /wallet).
    let onCompleted: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isCompleted = false

    var body: some View {
        NavigationStack {
            SBPWebView(url: paymentURL) {
                guard !isCompleted else { return }
                isCompleted = true
                onCompleted()
                dismiss()
            }
            .background(Color.white.ignoresSafeArea())
            .navigationTitle("Оплата · СБП")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
            }
        }
        .themed()
    }
}

private struct SBPWebView: UIViewRepresentable {
    let url: URL
    let onReachedWallet: () -> Void

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onReachedWallet: onReachedWallet)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let onReachedWallet: () -> Void

        init(onReachedWallet: @escaping () -> Void) {
            self.onReachedWallet = onReachedWallet
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            if webView.url?.path == "/wallet" {
                onReachedWallet()
            }
        }
    }
}
