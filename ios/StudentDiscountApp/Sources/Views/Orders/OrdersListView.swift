import SwiftUI

@MainActor
final class OrdersListViewModel: ObservableObject {
    @Published var orders: [Order] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            orders = try await APIClient.shared.get("/api/v1/orders")
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// История — заказы/полученные скидки, тихим списком без товарных карточек.
struct OrdersListView: View {
    @StateObject private var viewModel = OrdersListViewModel()
    @State private var didStartLoading = false

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.orders.isEmpty {
                RouteLoadingView()
            } else if let error = viewModel.errorMessage, viewModel.orders.isEmpty {
                RouteErrorState(message: error) { Task { await viewModel.load() } }
            } else if viewModel.orders.isEmpty {
                RouteEmptyState(title: "Пока нет истории", subtitle: "Полученные скидки появятся здесь")
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(viewModel.orders.sorted { $0.createdAt > $1.createdAt }) { order in
                            OrderRow(order: order)
                            if order.id != viewModel.orders.last?.id {
                                DottedDivider().padding(.leading, Theme.Spacing.l)
                            }
                        }
                    }
                    .padding(.vertical, Theme.Spacing.l)
                }
                .refreshable { await viewModel.load() }
            }
        }
        .background(Theme.Colors.background.ignoresSafeArea())
        .navigationTitle("История")
        .toolbarBackground(Theme.Colors.background, for: .navigationBar)
        .onAppear {
            // `.task` не всегда надёжно стартует на пуш-экранах вида
            // Профиль → История/Друзья/Уведомления/Кошелёк — используем
            // `.onAppear` с защитой от повторного запуска.
            guard !didStartLoading else { return }
            didStartLoading = true
            Task { await viewModel.load() }
        }
    }
}

private struct OrderRow: View {
    let order: Order

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Заказ №\(order.id)")
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text(order.createdAt.formatted(.dateTime.day().month().hour().minute()))
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textMuted)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text("\(Int(order.totalAmount)) ₽")
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text(order.statusLabel)
                    .font(Theme.Typography.label)
                    .foregroundStyle(statusColor)
            }
        }
        .padding(.horizontal, Theme.Spacing.l)
        .padding(.vertical, Theme.Spacing.m)
    }

    private var statusColor: Color {
        switch order.status {
        case "completed", "paid": return Theme.Colors.accent
        case "cancelled", "failed": return Theme.Colors.textMuted
        default: return Theme.Colors.textSecondary
        }
    }
}
