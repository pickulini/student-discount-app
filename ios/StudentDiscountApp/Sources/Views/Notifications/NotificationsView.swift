import SwiftUI

@MainActor
final class NotificationsViewModel: ObservableObject {
    @Published var notifications: [AppNotification] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            notifications = try await APIClient.shared.get("/api/v1/notifications")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func markRead(_ notification: AppNotification) async {
        guard notification.isUnread else { return }
        if let index = notifications.firstIndex(where: { $0.id == notification.id }) {
            notifications[index] = AppNotification(
                id: notification.id, type: notification.type, title: notification.title,
                body: notification.body, actorName: notification.actorName,
                actorAvatar: notification.actorAvatar, readAt: Date(), createdAt: notification.createdAt
            )
        }
        do {
            let _: EmptyResponse = try await APIClient.shared.post("/api/v1/notifications/\(notification.id)/read")
        } catch {
            // тихо игнорируем — локальное состояние уже обновлено
        }
    }

    func markAllRead() async {
        do {
            let _: EmptyResponse = try await APIClient.shared.post("/api/v1/notifications/read-all")
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct NotificationsView: View {
    @StateObject private var viewModel = NotificationsViewModel()

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.notifications.isEmpty {
                RouteLoadingView()
            } else if let error = viewModel.errorMessage, viewModel.notifications.isEmpty {
                RouteErrorState(message: error) { Task { await viewModel.load() } }
            } else if viewModel.notifications.isEmpty {
                RouteEmptyState(title: "Пока нет уведомлений", subtitle: nil)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(viewModel.notifications) { notification in
                            NotificationRow(notification: notification)
                                .onTapGesture {
                                    Task { await viewModel.markRead(notification) }
                                }
                            if notification.id != viewModel.notifications.last?.id {
                                DottedDivider().padding(.leading, 64)
                            }
                        }
                    }
                    .padding(.vertical, Theme.Spacing.l)
                }
                .refreshable { await viewModel.load() }
            }
        }
        .background(Theme.Colors.background.ignoresSafeArea())
        .navigationTitle("Уведомления")
        .toolbarBackground(Theme.Colors.background, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Прочитать всё") { Task { await viewModel.markAllRead() } }
                    .font(Theme.Typography.caption)
            }
        }
        .task { await viewModel.load() }
    }
}

private struct NotificationRow: View {
    let notification: AppNotification

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.m) {
            if notification.isUnread {
                Circle()
                    .fill(Theme.Colors.accent)
                    .frame(width: 6, height: 6)
                    .padding(.top, 6)
            } else {
                Circle()
                    .fill(.clear)
                    .frame(width: 6, height: 6)
                    .padding(.top, 6)
            }
            AvatarThumb(urlString: notification.actorAvatar, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(notification.title)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                if let body = notification.body {
                    Text(body)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
                Text(notification.createdAt.formatted(.relative(presentation: .named)))
                    .font(Theme.Typography.label)
                    .foregroundStyle(Theme.Colors.textMuted)
            }
            Spacer()
        }
        .padding(.horizontal, Theme.Spacing.l)
        .padding(.vertical, Theme.Spacing.s)
        .contentShape(Rectangle())
    }
}
