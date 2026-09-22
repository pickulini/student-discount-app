import SwiftUI

private let homeCategories = ["Все", "Еда", "Кофе", "Кино", "Спорт", "Музыка", "Другое"]

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var offers: [Offer] = []
    @Published var events: [Offer] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var category = "Все"

    private var discounts: [Offer] { offers.filter { !$0.isEvent } }

    var filteredDiscounts: [Offer] {
        guard category != "Все" else { return discounts }
        return discounts.filter { offer in
            offer.tags?.contains { $0.name.localizedCaseInsensitiveContains(category) } ?? false
        }
    }

    /// Пока без геолокации — плейсхолдер-срез той же ленты. Настоящее
    /// «рядом» появится, когда подключим CoreLocation и /offers/nearby.
    var nearby: [Offer] { Array(filteredDiscounts.prefix(4)) }

    var popular: [Offer] {
        Array(filteredDiscounts.sorted { $0.discountValue > $1.discountValue }.prefix(6))
    }

    var forYou: [Offer] {
        Array(filteredDiscounts.suffix(max(filteredDiscounts.count - 4, 0)))
    }

    var upcomingEvents: [Offer] { Array(events.prefix(5)) }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        async let offersTask: [Offer] = APIClient.shared.get("/api/v1/offers")
        async let eventsTask: [Offer] = APIClient.shared.get("/api/v1/events")
        do {
            offers = try await offersTask
            events = (try? await eventsTask) ?? []
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// Главный экран — не витрина, а лента открытий: приветствие, поиск,
/// категории минимальной текстовой навигацией, редакторские секции.
struct HomeView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = HomeViewModel()
    @State private var showingSearch = false

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.offers.isEmpty {
                    RouteLoadingView()
                } else if let error = viewModel.errorMessage, viewModel.offers.isEmpty {
                    RouteErrorState(message: error) { Task { await viewModel.load() } }
                } else {
                    content
                }
            }
            .background(Theme.Colors.background.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .principal) {
                    RouteMark(dotCount: 3, pointDiameter: 6)
                }
            }
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .navigationDestination(for: Offer.self) { offer in
                if offer.isEvent {
                    EventDetailView(event: offer)
                } else {
                    DiscountDetailView(offer: offer)
                }
            }
            .fullScreenCover(isPresented: $showingSearch) {
                SearchView(offers: viewModel.offers)
            }
        }
        .task { await viewModel.load() }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.xxl) {
                VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                    Text("Привет, \(session.currentUser?.fullName.components(separatedBy: " ").first ?? "")")
                        .font(Theme.Typography.largeTitle)
                        .foregroundStyle(Theme.Colors.textPrimary)

                    Button { showingSearch = true } label: {
                        HStack {
                            Image(systemName: "magnifyingglass")
                                .foregroundStyle(Theme.Colors.textMuted)
                            Text("Найти скидку, место или событие")
                                .font(Theme.Typography.body)
                                .foregroundStyle(Theme.Colors.textMuted)
                            Spacer()
                        }
                        .padding(.vertical, Theme.Spacing.m)
                        .padding(.horizontal, Theme.Spacing.l)
                        .background(Theme.Colors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, Theme.Spacing.l)

                CategoryTabs(categories: homeCategories, selected: $viewModel.category)

                feedSection(title: "Рядом с тобой", offers: viewModel.nearby)
                eventsSection
                feedSection(title: "Популярное", offers: viewModel.popular)
                feedSection(title: "Может понравиться", offers: viewModel.forYou)
            }
            .padding(.top, Theme.Spacing.m)
            .padding(.bottom, Theme.Spacing.xxxl)
        }
        .refreshable { await viewModel.load() }
    }

    @ViewBuilder
    private func feedSection(title: String, offers: [Offer]) -> some View {
        if !offers.isEmpty {
            VStack(alignment: .leading, spacing: Theme.Spacing.l) {
                SectionHeader(title: title)
                    .padding(.horizontal, Theme.Spacing.l)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: Theme.Spacing.l) {
                        ForEach(offers) { offer in
                            NavigationLink(value: offer) {
                                PlaceCard(offer: offer)
                                    .frame(width: 240)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.l)
                }
            }
        }
    }

    @ViewBuilder
    private var eventsSection: some View {
        if !viewModel.upcomingEvents.isEmpty {
            VStack(alignment: .leading, spacing: Theme.Spacing.l) {
                SectionHeader(title: "События рядом")
                    .padding(.horizontal, Theme.Spacing.l)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: Theme.Spacing.l) {
                        ForEach(viewModel.upcomingEvents) { event in
                            NavigationLink(value: event) {
                                EventCard(offer: event)
                                    .frame(width: 240)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.l)
                }
            }
        }
    }
}
