import SwiftUI

struct EventDetailView: View {
    @State var event: Offer
    @State private var isUpdatingRSVP = false
    @State private var rsvpError: String?
    @State private var showingPayment = false
    @State private var didRefresh = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                OfferImageView(offer: event)
                    .frame(height: Theme.Sizing.heroImageHeight)

                VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                    if let date = event.eventStartAt {
                        HStack(spacing: Theme.Spacing.s) {
                            Text(date.formatted(.dateTime.day().month(.wide)).uppercased())
                                .font(Theme.Typography.label)
                                .foregroundStyle(Theme.Colors.accent)
                            Text(date.formatted(.dateTime.hour().minute()))
                                .font(Theme.Typography.label)
                                .foregroundStyle(Theme.Colors.textSecondary)
                        }
                    }

                    Text(event.title)
                        .font(Theme.Typography.title)
                        .foregroundStyle(Theme.Colors.textPrimary)

                    if let address = event.address {
                        Text(address)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textSecondary)
                    }

                    HStack(spacing: Theme.Spacing.l) {
                        if let attendees = event.attendeesCount {
                            Text("\(attendees) идут")
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Colors.textSecondary)
                        }
                        if let interested = event.interestedCount {
                            Text("\(interested) интересуются")
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Colors.textSecondary)
                        }
                    }

                    DottedDivider()

                    if !event.description.isEmpty {
                        Text(event.description)
                            .font(Theme.Typography.body)
                            .foregroundStyle(Theme.Colors.textPrimary)
                    }

                    if let rsvpError {
                        Text(rsvpError)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(.red)
                    }

                    HStack(spacing: Theme.Spacing.m) {
                        Button {
                            // "Пойду" на бэкенде — это не простой RSVP, а покупка
                            // билета: статус "going" выставляется только после
                            // оплаты заказа (POST /events/{id}/schedule + confirm),
                            // поэтому показываем то же окно подтверждения оплаты,
                            // что и для скидок, а не дёргаем /rsvp напрямую.
                            if event.myAttendeeStatus != "going" {
                                showingPayment = true
                            }
                        } label: {
                            Text(event.myAttendeeStatus == "going" ? "Иду ✓" : "Пойду")
                        }
                        .buttonStyle(.routePrimary)

                        Button {
                            Task { await toggleInterested() }
                        } label: {
                            Text(event.myAttendeeStatus == "interested" ? "Интересно ✓" : "Интересно")
                        }
                        .buttonStyle(.routeGhost)
                    }
                    .disabled(isUpdatingRSVP)
                }
                .padding(Theme.Spacing.xl)
            }
        }
        .background(Theme.Colors.background.ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.Colors.background, for: .navigationBar)
        .onAppear {
            // Карточка события приходит из уже загруженного списка (лента,
            // афиша) и может быть устаревшей — например, если статус RSVP
            // или счётчики поменялись при прошлом визите на этот экран, а
            // список с тех пор не перезагружался. Подтягиваем актуальные
            // данные с сервера при каждом открытии, а не только один раз.
            guard !didRefresh else { return }
            didRefresh = true
            Task { await refresh() }
        }
        .sheet(isPresented: $showingPayment) {
            PaymentConfirmSheet(
                title: event.title,
                price: event.eventTicketPrice,
                createOrder: {
                    try await APIClient.shared.post("/api/v1/events/\(event.id)/schedule")
                }
            ) { _ in
                event.myAttendeeStatus = "going"
                event.attendeesCount = (event.attendeesCount ?? 0) + 1
            }
        }
    }

    private func refresh() async {
        do {
            let fresh: Offer = try await APIClient.shared.get("/api/v1/events/\(event.id)")
            event = fresh
        } catch {
            // Тихо игнорируем — экран уже показывает то, что передали из
            // списка, а актуализация не критична для первого рендера.
        }
    }

    /// "Интересно" — обычный RSVP-тумблер (interested/none), в отличие от
    /// "Пойду". Обновляем счётчик локально сразу же, не дожидаясь ответа
    /// сервера полностью — а после ответа подтягиваем эти же данные заново,
    /// чтобы не разъехаться, если RSVP уже стоял.
    private func toggleInterested() async {
        let wasInterested = event.myAttendeeStatus == "interested"
        isUpdatingRSVP = true
        rsvpError = nil
        defer { isUpdatingRSVP = false }
        do {
            let _: EmptyResponse = try await APIClient.shared.post(
                "/api/v1/events/\(event.id)/rsvp",
                body: RSVPRequest(status: wasInterested ? "none" : "interested")
            )
            event.myAttendeeStatus = wasInterested ? nil : "interested"
            let delta = wasInterested ? -1 : 1
            event.interestedCount = max((event.interestedCount ?? 0) + delta, 0)
        } catch {
            rsvpError = error.localizedDescription
        }
    }
}

private struct RSVPRequest: Encodable {
    let status: String
}
