import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var showingLogoutConfirm = false

    var body: some View {
        NavigationStack {
            Group {
                if let user = session.currentUser {
                    ScrollView {
                        VStack(spacing: Theme.Spacing.xxl) {
                            header(for: user)

                            DottedDivider().padding(.horizontal, Theme.Spacing.l)

                            VStack(spacing: 0) {
                                NavigationLink { WalletView() } label: {
                                    ProfileRow(icon: "wallet.pass", title: "Кошелёк")
                                }
                                ProfileDivider()
                                NavigationLink { OrdersListView() } label: {
                                    ProfileRow(icon: "clock.arrow.circlepath", title: "История")
                                }
                                ProfileDivider()
                                NavigationLink { FriendsView() } label: {
                                    ProfileRow(icon: "person.2", title: "Друзья")
                                }
                                ProfileDivider()
                                NavigationLink { NotificationsView() } label: {
                                    ProfileRow(icon: "bell", title: "Уведомления")
                                }
                            }
                            .background(Theme.Colors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous))
                            .padding(.horizontal, Theme.Spacing.l)

                            VStack(alignment: .leading, spacing: 0) {
                                SectionHeader(title: "Учёба")
                                    .padding(.horizontal, Theme.Spacing.l)
                                    .padding(.bottom, Theme.Spacing.s)
                                InfoLine(label: "Вуз", value: user.universityName ?? "Не указан")
                                if let course = user.course {
                                    InfoLine(label: "Курс", value: "\(course)")
                                }
                                InfoLine(label: "Статус", value: statusLabel(user.studentStatus))
                                InfoLine(label: "Реферальный код", value: user.referralCode, isLast: true)
                            }
                            .background(Theme.Colors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.medium, style: .continuous))
                            .padding(.horizontal, Theme.Spacing.l)

                            Button("Выйти", role: .destructive) {
                                showingLogoutConfirm = true
                            }
                            .font(Theme.Typography.body)
                            .foregroundStyle(.red)
                            .padding(.top, Theme.Spacing.m)
                            .padding(.bottom, Theme.Spacing.xxxl)
                        }
                        .padding(.top, Theme.Spacing.xl)
                    }
                    .refreshable { await session.refreshProfile() }
                } else if session.isLoading {
                    RouteLoadingView()
                } else {
                    RouteErrorState(message: session.errorMessage ?? "Не удалось загрузить профиль") {
                        Task { await session.refreshProfile() }
                    }
                }
            }
            .background(Theme.Colors.background.ignoresSafeArea())
            .navigationTitle("Профиль")
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .confirmationDialog(
                "Выйти из аккаунта?",
                isPresented: $showingLogoutConfirm,
                titleVisibility: .visible
            ) {
                Button("Выйти", role: .destructive) { session.logout() }
                Button("Отмена", role: .cancel) {}
            }
        }
    }

    private func header(for user: User) -> some View {
        VStack(spacing: Theme.Spacing.m) {
            AvatarThumb(urlString: user.avatarURL, size: 84)
            VStack(spacing: 2) {
                Text(user.fullName)
                    .font(Theme.Typography.title)
                    .foregroundStyle(Theme.Colors.textPrimary)
                if let username = user.username {
                    Text("@\(username)")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                } else {
                    Text(user.email)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
            }
            if user.isVIP {
                MetricBadge(text: "VIP", filled: true)
            }
        }
    }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "verified": return "Подтверждён"
        case "pending": return "На проверке"
        default: return "Не подтверждён"
        }
    }
}

private struct ProfileRow: View {
    let icon: String
    let title: String

    var body: some View {
        HStack(spacing: Theme.Spacing.m) {
            Image(systemName: icon)
                .foregroundStyle(Theme.Colors.accent)
                .frame(width: 22)
            Text(title)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(Theme.Colors.textMuted)
        }
        .padding(.horizontal, Theme.Spacing.l)
        .padding(.vertical, Theme.Spacing.m)
        .contentShape(Rectangle())
    }
}

private struct ProfileDivider: View {
    var body: some View {
        Rectangle()
            .fill(Theme.Colors.divider)
            .frame(height: 1)
            .padding(.leading, Theme.Spacing.l + 22 + Theme.Spacing.m)
    }
}

private struct InfoLine: View {
    let label: String
    let value: String
    var isLast: Bool = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(label)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                Spacer()
                Text(value)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
            }
            .padding(.horizontal, Theme.Spacing.l)
            .padding(.vertical, Theme.Spacing.m)

            if !isLast {
                Rectangle()
                    .fill(Theme.Colors.divider)
                    .frame(height: 1)
                    .padding(.leading, Theme.Spacing.l)
            }
        }
    }
}
