import SwiftUI

/// Окно подтверждения оплаты — используется и для покупки скидки, и для
/// участия в платном событии ("Пойду"): показывает сумму и текущий баланс,
/// и либо списывает оплату с баланса (единственный способ оплаты заказов
/// на бэкенде), либо, если денег не хватает, отправляет пополнить баланс
/// через эмуляцию СБП. Создание заказа параметризовано `createOrder`,
/// потому что скидка создаёт заказ через `POST /orders`, а событие — через
/// `POST /events/{id}/schedule`; дальше оба сценария одинаково подтверждаются
/// через `POST /orders/{id}/confirm`.
struct PaymentConfirmSheet: View {
    let title: String
    let price: Double
    let createOrder: () async throws -> Order
    let onPaid: (Order) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var wallet: Wallet?
    @State private var isLoadingWallet = true
    @State private var isPaying = false
    @State private var errorMessage: String?
    @State private var showingTopUp = false

    private var hasEnoughBalance: Bool {
        guard let wallet else { return false }
        return wallet.balance >= price
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: Theme.Spacing.xl) {
                VStack(spacing: Theme.Spacing.s) {
                    Text("К ОПЛАТЕ")
                        .font(Theme.Typography.label)
                        .foregroundStyle(Theme.Colors.textSecondary)
                    Text(price > 0 ? "\(Int(price)) ₽" : "Бесплатно")
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Text(title)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, Theme.Spacing.xl)

                DottedDivider()

                VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                    HStack {
                        Image(systemName: "wallet.pass")
                            .foregroundStyle(Theme.Colors.accent)
                        Text("Баланс кошелька")
                            .font(Theme.Typography.body)
                            .foregroundStyle(Theme.Colors.textPrimary)
                        Spacer()
                        if isLoadingWallet {
                            ProgressView()
                        } else if let wallet {
                            Text("\(Int(wallet.balance)) ₽")
                                .font(Theme.Typography.body)
                                .foregroundStyle(hasEnoughBalance ? Theme.Colors.textPrimary : .red)
                        }
                    }
                    .padding(Theme.Spacing.l)
                    .background(Theme.Colors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous))

                    if !isLoadingWallet, !hasEnoughBalance, price > 0 {
                        Text("Недостаточно средств на балансе. Пополните кошелёк, чтобы продолжить.")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textSecondary)
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(.red)
                }

                Spacer()

                if price > 0 && !isLoadingWallet && !hasEnoughBalance {
                    Button("Пополнить баланс") { showingTopUp = true }
                        .buttonStyle(.routePrimary)
                } else {
                    Button {
                        Task { await pay() }
                    } label: {
                        if isPaying {
                            RouteLoadingIndicator()
                        } else {
                            Text("Подтвердить оплату")
                        }
                    }
                    .buttonStyle(.routePrimary)
                    .disabled(isPaying || isLoadingWallet)
                }
            }
            .padding(Theme.Spacing.xl)
            .background(Theme.Colors.background.ignoresSafeArea())
            .navigationTitle("Оплата")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
            }
            .onAppear { Task { await loadWallet() } }
            .sheet(isPresented: $showingTopUp) {
                TopUpView {
                    Task { await loadWallet() }
                }
            }
        }
        .themed()
    }

    private func loadWallet() async {
        isLoadingWallet = true
        do {
            wallet = try await APIClient.shared.get("/api/v1/wallet")
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoadingWallet = false
    }

    private func pay() async {
        isPaying = true
        errorMessage = nil
        defer { isPaying = false }
        do {
            let order = try await createOrder()
            let _: EmptyResponse = try await APIClient.shared.post("/api/v1/orders/\(order.id)/confirm")
            onPaid(Order(
                id: order.id,
                offerID: order.offerID,
                subtotal: order.subtotal,
                discountAmount: order.discountAmount,
                bonusAmount: order.bonusAmount,
                totalAmount: order.totalAmount,
                status: "paid",
                createdAt: order.createdAt
            ))
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
