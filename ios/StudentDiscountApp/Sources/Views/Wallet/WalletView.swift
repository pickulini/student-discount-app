import SwiftUI

@MainActor
final class WalletViewModel: ObservableObject {
    @Published var wallet: Wallet?
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            wallet = try await APIClient.shared.get("/api/v1/wallet")
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct WalletView: View {
    @StateObject private var viewModel = WalletViewModel()
    @State private var showingTopUp = false
    @State private var didStartLoading = false

    var body: some View {
        Group {
            // Порядок веток важен: как только баланс загружен — показываем
            // его в первую очередь, иначе по умолчанию показываем лоадер
            // (а не пустой экран), пока запрос не завершится ошибкой или
            // успехом. Раньше здесь не было ветки "по умолчанию", и если
            // `.task` не успевал стартовать до первой отрисовки, экран
            // оставался буквально пустым — цвет фона и ничего больше.
            if let wallet = viewModel.wallet {
                ScrollView {
                    VStack(spacing: Theme.Spacing.xxxl) {
                        VStack(spacing: Theme.Spacing.s) {
                            Text("БАЛАНС")
                                .font(Theme.Typography.label)
                                .foregroundStyle(Theme.Colors.textSecondary)
                            Text("\(Int(wallet.balance)) ₽")
                                .font(.system(size: 44, weight: .bold, design: .rounded))
                                .foregroundStyle(Theme.Colors.textPrimary)

                            Button("Пополнить") { showingTopUp = true }
                                .buttonStyle(.routePrimary)
                                .frame(width: 180)
                                .padding(.top, Theme.Spacing.m)
                        }
                        .padding(.top, Theme.Spacing.xxxl)

                        DottedDivider().padding(.horizontal, Theme.Spacing.xxxl)

                        VStack(spacing: Theme.Spacing.s) {
                            Text("БОНУСЫ")
                                .font(Theme.Typography.label)
                                .foregroundStyle(Theme.Colors.textSecondary)
                            Text("\(Int(wallet.bonus))")
                                .font(Theme.Typography.metric)
                                .foregroundStyle(Theme.Colors.accent)
                        }

                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                    .padding(Theme.Spacing.l)
                }
                .refreshable { await viewModel.load() }
            } else if let error = viewModel.errorMessage {
                RouteErrorState(message: error) { Task { await viewModel.load() } }
            } else {
                RouteLoadingView()
            }
        }
        .background(Theme.Colors.background.ignoresSafeArea())
        .navigationTitle("Кошелёк")
        .toolbarBackground(Theme.Colors.background, for: .navigationBar)
        .onAppear {
            // `.onAppear` вместо `.task`: на этом экране (вложенный push из
            // NavigationLink в другом таб-баре) `.task` иногда не запускался
            // на первом появлении, и экран оставался пустым навсегда.
            // Флаг защищает от повторного запуска при каждом появлении.
            guard !didStartLoading else { return }
            didStartLoading = true
            Task { await viewModel.load() }
        }
        .sheet(isPresented: $showingTopUp) {
            TopUpView {
                Task { await viewModel.load() }
            }
        }
    }
}

/// Экран пополнения баланса: сумма → инициация платежа на бэкенде →
/// эмуляция СБП-чекаута в вебвью → обновление баланса после подтверждения.
struct TopUpView: View {
    let onCompleted: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var amountText = "500"
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var checkoutTarget: CheckoutTarget?

    private let presets: [Double] = [300, 500, 1000, 2000]

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                    Text("СУММА ПОПОЛНЕНИЯ")
                        .font(Theme.Typography.label)
                        .foregroundStyle(Theme.Colors.textSecondary)

                    HStack {
                        TextField("0", text: $amountText)
                            .keyboardType(.numberPad)
                            .font(.system(size: 36, weight: .bold, design: .rounded))
                            .foregroundStyle(Theme.Colors.textPrimary)
                        Text("₽")
                            .font(.system(size: 28, weight: .semibold, design: .rounded))
                            .foregroundStyle(Theme.Colors.textMuted)
                    }
                    .padding(.vertical, Theme.Spacing.s)
                    .background(alignment: .bottom) {
                        Rectangle().fill(Theme.Colors.divider).frame(height: 1)
                    }
                }

                HStack(spacing: Theme.Spacing.s) {
                    ForEach(presets, id: \.self) { value in
                        Button {
                            amountText = String(Int(value))
                        } label: {
                            Text("\(Int(value)) ₽")
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Colors.textPrimary)
                                .padding(.horizontal, Theme.Spacing.m)
                                .padding(.vertical, Theme.Spacing.s)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Theme.Radius.small, style: .continuous)
                                        .strokeBorder(Theme.Colors.divider, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(.red)
                }

                Spacer()

                Button {
                    Task { await startTopUp() }
                } label: {
                    if isSubmitting {
                        RouteLoadingIndicator()
                    } else {
                        Text("Пополнить через СБП")
                    }
                }
                .buttonStyle(.routePrimary)
                .disabled(isSubmitting || (Double(amountText) ?? 0) <= 0)
            }
            .padding(Theme.Spacing.xl)
            .background(Theme.Colors.background.ignoresSafeArea())
            .navigationTitle("Пополнение")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Закрыть") { dismiss() }
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
            }
            .fullScreenCover(item: $checkoutTarget) { target in
                SBPCheckoutSheet(paymentURL: target.url) {
                    onCompleted()
                    dismiss()
                }
            }
        }
        .themed()
    }

    private func startTopUp() async {
        guard let amount = Double(amountText), amount > 0 else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        do {
            let response: InitPaymentResponse = try await APIClient.shared.post(
                "/api/v1/payments/init",
                body: InitPaymentRequest(amount: amount)
            )
            if let url = URL(string: response.paymentURL) {
                checkoutTarget = CheckoutTarget(url: url)
            } else {
                errorMessage = "Сервер вернул некорректную ссылку на оплату"
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct CheckoutTarget: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}
