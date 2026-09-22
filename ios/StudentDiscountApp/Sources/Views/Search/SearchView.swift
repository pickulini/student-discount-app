import SwiftUI

private enum SearchScope: String, CaseIterable {
    case all = "Все"
    case discounts = "Скидки"
    case places = "Места"
    case events = "События"
}

/// Полноэкранный поиск в нативной iOS-манере: вертикальная редакторская
/// лента результатов, без сетки товаров.
struct SearchView: View {
    let offers: [Offer]

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var scope: SearchScope = .all

    private var results: [Offer] {
        let base: [Offer]
        switch scope {
        case .all: base = offers
        case .discounts: base = offers.filter { !$0.isEvent }
        case .places: base = offers.filter { !$0.isEvent && $0.placeName != nil }
        case .events: base = offers.filter { $0.isEvent }
        }
        guard !query.isEmpty else { return base }
        return base.filter {
            $0.title.localizedCaseInsensitiveContains(query)
                || ($0.placeName?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: Theme.Spacing.l) {
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(Theme.Colors.textMuted)
                    TextField("Найти скидку, место или событие", text: $query)
                        .textFieldStyle(.plain)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    if !query.isEmpty {
                        Button {
                            query = ""
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(Theme.Colors.textMuted)
                        }
                    }
                }
                .padding(.horizontal, Theme.Spacing.l)
                .padding(.vertical, Theme.Spacing.m)
                .background(Theme.Colors.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous))
                .padding(.horizontal, Theme.Spacing.l)

                Picker("", selection: $scope) {
                    ForEach(SearchScope.allCases, id: \.self) { scope in
                        Text(scope.rawValue).tag(scope)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Theme.Spacing.l)

                if results.isEmpty {
                    RouteEmptyState(title: "Ничего не найдено", subtitle: "Попробуйте другой запрос")
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                            ForEach(results) { offer in
                                NavigationLink {
                                    if offer.isEvent {
                                        EventDetailView(event: offer)
                                    } else {
                                        DiscountDetailView(offer: offer)
                                    }
                                } label: {
                                    if offer.isEvent {
                                        EventCard(offer: offer)
                                    } else {
                                        PlaceCard(offer: offer)
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(Theme.Spacing.l)
                    }
                }
            }
            .padding(.top, Theme.Spacing.s)
            .background(Theme.Colors.background.ignoresSafeArea())
            .navigationTitle("Поиск")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Закрыть") { dismiss() }
                }
            }
        }
    }
}
