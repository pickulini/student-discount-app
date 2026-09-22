import SwiftUI

struct DiscountDetailView: View {
    let offer: Offer

    @State private var isCreatingOrder = false
    @State private var orderError: String?
    @State private var createdOrder: Order?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                OfferImageView(offer: offer)
                    .frame(height: 280)

                VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(offer.title)
                                .font(Theme.Typography.title)
                                .foregroundStyle(Theme.Colors.textPrimary)
                            Spacer()
                            if offer.discountValue > 0 {
                                Text(offer.discountBadge)
                                    .font(Theme.Typography.metric)
                                    .foregroundStyle(Theme.Colors.accent)
                            }
                        }
                        if let placeName = offer.placeName {
                            Text(placeName)
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Colors.textSecondary)
                        }
                    }

                    DottedDivider()

                    if !offer.description.isEmpty {
                        Text(offer.description)
                            .font(Theme.Typography.body)
                            .foregroundStyle(Theme.Colors.textPrimary)
                    }

                    if let tags = offer.tags, !tags.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: Theme.Spacing.s) {
                                ForEach(tags) { tag in
                                    Text(tag.name.uppercased())
                                        .font(Theme.Typography.label)
                                        .foregroundStyle(Theme.Colors.textSecondary)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .overlay(
                                            Capsule().strokeBorder(Theme.Colors.divider, lineWidth: 1)
                                        )
                                }
                            }
                        }
                    }

                    DottedDivider()

                    VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                        if let address = offer.address {
                            InfoRow(label: "Адрес", value: address)
                        }
                        if let workingHours = offer.workingHours {
                            InfoRow(label: "Часы работы", value: workingHours)
                        }
                        if let phone = offer.phone {
                            InfoRow(label: "Телефон", value: phone)
                        }
                        if let website = offer.website {
                            InfoRow(label: "Сайт", value: website)
                        }
                    }

                    if let orderError {
                        Text(orderError)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(.red)
                    }

                    ctaButton
                }
                .padding(Theme.Spacing.xl)
            }
        }
        .background(Theme.Colors.background.ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Colors.background, for: .navigationBar)
    }

    @ViewBuilder
    private var ctaButton: some View {
        if let createdOrder {
            VStack(spacing: Theme.Spacing.s) {
                Text("Скидка получена")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(Theme.Colors.accent)
                Text("Заказ №\(createdOrder.id) · \(createdOrder.statusLabel)")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.m)
        } else {
            Button {
                Task { await createOrder() }
            } label: {
                if isCreatingOrder {
                    RouteLoadingIndicator()
                } else {
                    Text(offer.displayPrice > 0 ? "Купить за \(Int(offer.displayPrice)) ₽" : "Получить скидку")
                }
            }
            .buttonStyle(.routePrimary)
            .disabled(isCreatingOrder)
        }
    }

    private func createOrder() async {
        isCreatingOrder = true
        orderError = nil
        defer { isCreatingOrder = false }
        do {
            let order: Order = try await APIClient.shared.post(
                "/api/v1/orders",
                body: CreateOrderRequest(offerID: offer.id, bonusPoints: 0)
            )
            createdOrder = order
        } catch {
            orderError = error.localizedDescription
        }
    }
}

private struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(Theme.Typography.label)
                .foregroundStyle(Theme.Colors.textMuted)
            Text(value)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
        }
    }
}

extension Offer: Hashable {
    static func == (lhs: Offer, rhs: Offer) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
