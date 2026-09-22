import SwiftUI

@MainActor
final class DiscountsListViewModel: ObservableObject {
    @Published var offers: [Offer] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var searchText = ""

    /// Только обычные скидки/места — события показываются в отдельной вкладке.
    var filteredOffers: [Offer] {
        let discounts = offers.filter { !$0.isEvent }
        guard !searchText.isEmpty else { return discounts }
        return discounts.filter {
            $0.title.localizedCaseInsensitiveContains(searchText)
                || ($0.placeName?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            offers = try await APIClient.shared.get("/api/v1/offers")
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// Лента скидок как city-guide, не витрина: вертикальный редакторский список
/// вместо сетки карточек-товаров.
struct DiscountsListView: View {
    @StateObject private var viewModel = DiscountsListViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.offers.isEmpty {
                    RouteLoadingView()
                } else if let error = viewModel.errorMessage, viewModel.offers.isEmpty {
                    RouteErrorState(message: error) {
                        Task { await viewModel.load() }
                    }
                } else if viewModel.filteredOffers.isEmpty {
                    RouteEmptyState(
                        title: "Пока нет предложений",
                        subtitle: "Загляните позже — маршрут пополнится новыми местами"
                    )
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: Theme.Spacing.xxl) {
                            ForEach(viewModel.filteredOffers) { offer in
                                NavigationLink(value: offer) {
                                    PlaceCard(offer: offer)
                                }
                                .buttonStyle(.plain)

                                if offer.id != viewModel.filteredOffers.last?.id {
                                    DottedDivider()
                                }
                            }
                        }
                        .padding(Theme.Spacing.l)
                    }
                    .refreshable { await viewModel.load() }
                }
            }
            .background(Theme.Colors.background.ignoresSafeArea())
            .navigationTitle("Скидки")
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .searchable(text: $viewModel.searchText, prompt: "Найти скидку или место")
            .navigationDestination(for: Offer.self) { offer in
                DiscountDetailView(offer: offer)
            }
        }
        .task { await viewModel.load() }
    }
}
