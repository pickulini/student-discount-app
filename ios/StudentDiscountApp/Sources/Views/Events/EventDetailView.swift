import SwiftUI

struct EventDetailView: View {
    @State var event: Offer
    @State private var isUpdatingRSVP = false
    @State private var rsvpError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                OfferImageView(offer: event)
                    .frame(height: 280)

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
                            Task { await setRSVP("going") }
                        } label: {
                            Text(event.myAttendeeStatus == "going" ? "Иду ✓" : "Пойду")
                        }
                        .buttonStyle(.routePrimary)

                        Button {
                            Task { await setRSVP("interested") }
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
    }

    private func setRSVP(_ status: String) async {
        isUpdatingRSVP = true
        rsvpError = nil
        defer { isUpdatingRSVP = false }
        do {
            let _: EmptyResponse = try await APIClient.shared.post(
                "/api/v1/events/\(event.id)/rsvp",
                body: RSVPRequest(status: status)
            )
            event.myAttendeeStatus = status
        } catch {
            rsvpError = error.localizedDescription
        }
    }
}

private struct RSVPRequest: Encodable {
    let status: String
}
