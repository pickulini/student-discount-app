import SwiftUI

private enum FriendsTab: String, CaseIterable {
    case friends = "Друзья"
    case requests = "Заявки"
    case search = "Поиск"
}

@MainActor
final class FriendsViewModel: ObservableObject {
    @Published var friends: [UserPublicCard] = []
    @Published var incoming: [UserPublicCard] = []
    @Published var outgoing: [UserPublicCard] = []
    @Published var searchResults: [UserPublicCard] = []
    @Published var searchQuery = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    func loadAll() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        async let friendsTask: [UserPublicCard] = APIClient.shared.get("/api/v1/friends")
        async let incomingTask: [UserPublicCard] = APIClient.shared.get("/api/v1/friends/requests/incoming")
        async let outgoingTask: [UserPublicCard] = APIClient.shared.get("/api/v1/friends/requests/outgoing")
        do {
            friends = try await friendsTask
            incoming = (try? await incomingTask) ?? []
            outgoing = (try? await outgoingTask) ?? []
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func search() async {
        guard !searchQuery.isEmpty else {
            searchResults = []
            return
        }
        do {
            searchResults = try await APIClient.shared.get(
                "/api/v1/friends/search",
                query: ["q": searchQuery]
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sendRequest(to userID: Int64) async {
        do {
            let _: Friendship = try await APIClient.shared.post(
                "/api/v1/friends/requests",
                body: SendFriendRequestBody(userID: userID)
            )
            await search()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func accept(requestID: Int64) async {
        do {
            let _: EmptyResponse = try await APIClient.shared.post("/api/v1/friends/requests/\(requestID)/accept")
            await loadAll()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func reject(requestID: Int64) async {
        do {
            let _: EmptyResponse = try await APIClient.shared.post("/api/v1/friends/requests/\(requestID)/reject")
            await loadAll()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func cancel(requestID: Int64) async {
        do {
            let _: EmptyResponse = try await APIClient.shared.post("/api/v1/friends/requests/\(requestID)/cancel")
            await loadAll()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct SendFriendRequestBody: Encodable {
    let userID: Int64
    enum CodingKeys: String, CodingKey { case userID = "user_id" }
}

struct FriendsView: View {
    @StateObject private var viewModel = FriendsViewModel()
    @State private var tab: FriendsTab = .friends
    @State private var didStartLoading = false

    var body: some View {
        VStack(spacing: Theme.Spacing.l) {
            Picker("", selection: $tab) {
                ForEach(FriendsTab.allCases, id: \.self) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, Theme.Spacing.l)
            .padding(.top, Theme.Spacing.s)

            Group {
                switch tab {
                case .friends: friendsList
                case .requests: requestsList
                case .search: searchTab
                }
            }
        }
        .background(Theme.Colors.background.ignoresSafeArea())
        .navigationTitle("Друзья")
        .toolbarBackground(Theme.Colors.background, for: .navigationBar)
        .onAppear {
            guard !didStartLoading else { return }
            didStartLoading = true
            Task { await viewModel.loadAll() }
        }
    }

    private var friendsList: some View {
        Group {
            if viewModel.isLoading && viewModel.friends.isEmpty {
                RouteLoadingView()
            } else if viewModel.friends.isEmpty {
                RouteEmptyState(title: "Пока нет друзей", subtitle: "Найдите знакомых во вкладке «Поиск»")
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(viewModel.friends) { friend in
                            PersonRow(person: friend)
                            if friend.id != viewModel.friends.last?.id {
                                DottedDivider().padding(.leading, 64)
                            }
                        }
                    }
                }
                .refreshable { await viewModel.loadAll() }
            }
        }
    }

    private var requestsList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                if !viewModel.incoming.isEmpty {
                    VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                        SectionHeader(title: "Входящие").padding(.horizontal, Theme.Spacing.l)
                        ForEach(viewModel.incoming) { person in
                            PersonRow(person: person) {
                                HStack(spacing: Theme.Spacing.s) {
                                    Button("Принять") {
                                        Task { await viewModel.accept(requestID: person.friendshipID ?? 0) }
                                    }
                                    .font(Theme.Typography.caption)
                                    .foregroundStyle(Theme.Colors.accent)

                                    Button("Отклонить") {
                                        Task { await viewModel.reject(requestID: person.friendshipID ?? 0) }
                                    }
                                    .font(Theme.Typography.caption)
                                    .foregroundStyle(Theme.Colors.textMuted)
                                }
                            }
                        }
                    }
                }
                if !viewModel.outgoing.isEmpty {
                    VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                        SectionHeader(title: "Исходящие").padding(.horizontal, Theme.Spacing.l)
                        ForEach(viewModel.outgoing) { person in
                            PersonRow(person: person) {
                                Button("Отменить") {
                                    Task { await viewModel.cancel(requestID: person.friendshipID ?? 0) }
                                }
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Colors.textMuted)
                            }
                        }
                    }
                }
                if viewModel.incoming.isEmpty && viewModel.outgoing.isEmpty {
                    RouteEmptyState(title: "Нет заявок", subtitle: nil)
                        .padding(.top, Theme.Spacing.xxxl)
                }
            }
            .padding(.vertical, Theme.Spacing.l)
        }
    }

    private var searchTab: some View {
        VStack(spacing: 0) {
            TextField("Имя или username", text: $viewModel.searchQuery)
                .textFieldStyle(.route)
                .padding(.horizontal, Theme.Spacing.l)
                .onSubmit { Task { await viewModel.search() } }
                .onChange(of: viewModel.searchQuery) { _ in
                    Task { await viewModel.search() }
                }

            if viewModel.searchResults.isEmpty {
                RouteEmptyState(title: "Введите имя для поиска", subtitle: nil)
                    .padding(.top, Theme.Spacing.xxxl)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(viewModel.searchResults) { person in
                            PersonRow(person: person) {
                                Button("Добавить") {
                                    Task { await viewModel.sendRequest(to: person.id) }
                                }
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Colors.accent)
                            }
                        }
                    }
                    .padding(.top, Theme.Spacing.l)
                }
            }
        }
    }
}

private struct PersonRow<Trailing: View>: View {
    let person: UserPublicCard
    @ViewBuilder var trailing: () -> Trailing

    init(person: UserPublicCard, @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }) {
        self.person = person
        self.trailing = trailing
    }

    var body: some View {
        HStack(spacing: Theme.Spacing.m) {
            AvatarThumb(urlString: person.avatarURL)
            VStack(alignment: .leading, spacing: 2) {
                Text(person.displayName)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                if let university = person.university {
                    Text(university)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
            }
            Spacer()
            trailing()
        }
        .padding(.horizontal, Theme.Spacing.l)
        .padding(.vertical, Theme.Spacing.m)
    }
}

struct AvatarThumb: View {
    let urlString: String?
    var size: CGFloat = 44

    var body: some View {
        Group {
            if let urlString, let url = URL(string: urlString, relativeTo: AppConfig.baseURL) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var placeholder: some View {
        Circle()
            .fill(Theme.Colors.surfaceSecondary)
            .overlay(
                Image(systemName: "person.fill")
                    .foregroundStyle(Theme.Colors.textMuted)
            )
    }
}
