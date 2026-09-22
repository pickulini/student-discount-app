import SwiftUI

@MainActor
final class EventsListViewModel: ObservableObject {
    @Published var events: [Offer] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            events = try await APIClient.shared.get("/api/v1/events")
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// Афиша событий — отдельный, ярко editorial раздел: крупные даты, фото.
struct EventsListView: View {
    @StateObject private var viewModel = EventsListViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.events.isEmpty {
                    RouteLoadingView()
                } else if let error = viewModel.errorMessage, viewModel.events.isEmpty {
                    RouteErrorState(message: error) {
                        Task { await viewModel.load() }
                    }
                } else if viewModel.events.isEmpty {
                    RouteEmptyState(
                        title: "Событий пока нет",
                        subtitle: "Здесь появятся концерты, встречи и активности рядом"
                    )
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: Theme.Spacing.xxl) {
                            ForEach(viewModel.events) { event in
                                NavigationLink(value: event) {
                                    EventCard(offer: event)
                                }
                                .buttonStyle(.plain)

                                if event.id != viewModel.events.last?.id {
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
            .navigationTitle("События")
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .navigationDestination(for: Offer.self) { event in
                EventDetailView(event: event)
            }
        }
        .task { await viewModel.load() }
    }
}
