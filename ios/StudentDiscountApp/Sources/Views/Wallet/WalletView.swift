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

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.wallet == nil {
                RouteLoadingView()
            } else if let error = viewModel.errorMessage, viewModel.wallet == nil {
                RouteErrorState(message: error) { Task { await viewModel.load() } }
            } else if let wallet = viewModel.wallet {
                ScrollView {
                    VStack(spacing: Theme.Spacing.xxxl) {
                        VStack(spacing: Theme.Spacing.s) {
                            Text("БАЛАНС")
                                .font(Theme.Typography.label)
                                .foregroundStyle(Theme.Colors.textSecondary)
                            Text("\(Int(wallet.balance)) ₽")
                                .font(.system(size: 44, weight: .bold, design: .rounded))
                                .foregroundStyle(Theme.Colors.textPrimary)
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
            }
        }
        .background(Theme.Colors.background.ignoresSafeArea())
        .navigationTitle("Кошелёк")
        .toolbarBackground(Theme.Colors.background, for: .navigationBar)
        .task { await viewModel.load() }
    }
}
