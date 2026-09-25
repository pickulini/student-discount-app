package http

import (
	"net/http"
	"your-project/internal/infrastructure/crypto"
	"your-project/internal/repository"
	"your-project/internal/transport/http/handlers"
	"your-project/internal/transport/http/middleware"
	"your-project/internal/usecase"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
)

func NewRouterProto(
	authUsecase *usecase.AuthUsecase,
	userUsecase *usecase.UserUsecase,
	companyUsecase *usecase.CompanyUsecase,
	orderUsecase *usecase.OrderUsecase,
	paymentUsecase *usecase.PaymentUsecase,
	referralUsecase *usecase.ReferralUsecase,
	supportUsecase *usecase.SupportUsecase,
	merchantUsecase *usecase.MerchantUsecase,
	walletHandler *handlers.WalletHandler,
	adminHandler *handlers.AdminHandler,
	supportHandler *handlers.SupportHandler,
	merchantHandler *handlers.MerchantHandler,
	paymentHandler *handlers.PaymentHandler,
	auditUsecase *usecase.AuditUsecase,
	auditHandler *handlers.AuditHandler,
    tagHandler *handlers.TagHandler,
	subscriptionHandler *handlers.SubscriptionHandler,
	eventHandler *handlers.EventHandler,
	notificationHandler *handlers.NotificationHandler,
    friendHandler *handlers.FriendHandler,
    uploadHandler *handlers.UploadHandler,
	cabinetHandler *handlers.CabinetHandler,
	userRepo repository.UserRepository,
	jwtManager *crypto.JWTManager,
	allowedOrigin string,
	loginRateLimitPerMin int,
) *chi.Mux {
	r := chi.NewRouter()
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(middleware.SecurityHeaders)
	r.Use(middleware.CORS(allowedOrigin))
	r.Use(middleware.RequestInfo)

	authHandler := handlers.NewAuthHandler(authUsecase)
	userHandler := handlers.NewUserHandler(userUsecase)
	userHandler.Extras = cabinetHandler.UserExtras
	companyHandler := handlers.NewCompanyHandler(companyUsecase)
	orderHandler := handlers.NewOrderHandler(orderUsecase)
	referralHandler := handlers.NewReferralHandler(referralUsecase)

	// Публичные
	// Логин и регистрация — под rate-limit по IP: раньше на /auth/login не было
	// никакой защиты от перебора паролей.
	r.With(middleware.RateLimit(loginRateLimitPerMin)).Post("/api/v1/auth/register", authHandler.Register)
	r.With(middleware.RateLimit(loginRateLimitPerMin)).Post("/api/v1/auth/login", authHandler.Login)
	r.Post("/api/v1/auth/refresh", authHandler.Refresh)
	r.Get("/api/v1/companies", companyHandler.ListCompanies)
	r.Get("/api/v1/universities", companyHandler.ListUniversities)
	r.Get("/api/v1/stats/public", cabinetHandler.PublicStats)
	r.Get("/api/v1/offers", cabinetHandler.ListOffers)
    r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir("/app/uploads"))))
	r.Get("/api/v1/offers/nearby", companyHandler.GetNearbyOffers)
	r.With(middleware.OptionalAuth(jwtManager)).Get("/api/v1/offers/{id}", cabinetHandler.GetOffer)
	r.With(middleware.OptionalAuth(jwtManager)).Get("/api/v1/companies/{id}/stats", subscriptionHandler.CompanyStats)
    r.Get("/api/v1/tags", tagHandler.List)
	r.Get("/api/v1/tags/popular", tagHandler.Popular)
	r.Get("/api/v1/tags/search", tagHandler.Search)
    r.Get("/api/v1/users/by-username/{username}", userHandler.GetPublicProfile)
	r.Get("/api/v1/users/by-username/{username}/companies", userHandler.GetPublicCompanies)
	r.With(middleware.OptionalAuth(jwtManager)).Get("/api/v1/users/by-username/{username}/subscriptions", userHandler.GetPublicSubscriptions)
	r.Get("/api/v1/users/by-username/{username}/events", eventHandler.ByUsername)
	r.Get("/api/v1/users/by-username/{username}/attending", eventHandler.AttendingByUsername)
	r.With(middleware.OptionalAuth(jwtManager)).Get("/api/v1/users/by-username/{username}/extras", cabinetHandler.ProfileExtras)

	// Публичные страницы оплаты (эмуляция СБП)
	r.Get("/payments/sbp/checkout/{id}", paymentHandler.ConfirmPayment)
	r.Post("/payments/sbp/checkout/{id}", paymentHandler.ConfirmPayment)
	r.Post("/payments/sbp/confirm/{id}", paymentHandler.ConfirmPayment)
	r.Get("/payments/sbp/done", paymentHandler.PaymentDone)
	r.Post("/api/v1/payments/webhook", paymentHandler.WebhookHandler)

	// Защищённые
	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(jwtManager))

		// Пользователь
		r.Get("/api/v1/users/me", userHandler.GetProfile)

        // Друзья
        r.Get("/api/v1/friends", friendHandler.ListFriends)
        r.Get("/api/v1/friends/overview", cabinetHandler.FriendsOverview)
        r.Get("/api/v1/friends/search", friendHandler.Search)
        r.Post("/api/v1/friends/requests", friendHandler.SendRequest)
        r.Post("/api/v1/friends/requests/{id}/accept", friendHandler.Accept)
        r.Post("/api/v1/friends/requests/{id}/reject", friendHandler.Reject)
        r.Post("/api/v1/friends/requests/{id}/cancel", friendHandler.Cancel)
        r.Get("/api/v1/friends/requests/incoming", friendHandler.ListIncoming)
        r.Get("/api/v1/friends/requests/outgoing", friendHandler.ListOutgoing)
        r.Get("/api/v1/friends/status/{userId}", friendHandler.GetStatus)
        r.Delete("/api/v1/friends/{userId}", friendHandler.RemoveFriend)
        r.Patch("/api/v1/users/me", userHandler.UpdateProfile)
		r.Patch("/api/v1/users/me/privacy", userHandler.UpdatePrivacy)
		r.Patch("/api/v1/users/me/search-visibility", cabinetHandler.SetSearchable)
		r.Get("/api/v1/users/username-available", cabinetHandler.UsernameAvailable)
		r.Patch("/api/v1/users/me/password", authHandler.ChangePassword)
		r.Get("/api/v1/users/me/sessions", authHandler.ListSessions)
		r.Delete("/api/v1/users/me/sessions", authHandler.RevokeAllSessions)
		r.Delete("/api/v1/users/me/sessions/{id}", authHandler.RevokeSession)
		r.Delete("/api/v1/users/me", authHandler.DeleteAccount)
        r.Post("/api/v1/users/upload-avatar", uploadHandler.Upload)
		r.Get("/api/v1/users/transactions", userHandler.GetTransactionHistory)
		r.Get("/api/v1/notifications/stream", notificationHandler.Stream)
		r.Get("/api/v1/notifications", notificationHandler.List)
		r.Get("/api/v1/notifications/unread/count", notificationHandler.CountUnread)
		r.Post("/api/v1/notifications/{id}/read", notificationHandler.MarkRead)
		r.Delete("/api/v1/notifications/all", notificationHandler.DeleteAll)
		r.Delete("/api/v1/notifications/{id}", notificationHandler.Delete)
		r.Post("/api/v1/notifications/read-all", notificationHandler.MarkAllRead)
		r.Get("/api/v1/users/me/notification-settings", notificationHandler.GetSettings)
		r.Patch("/api/v1/users/me/notification-settings", notificationHandler.UpdateSettings)

		// Верификация
		r.Post("/api/v1/students/verify", authHandler.RequestVerification)
		r.Get("/api/v1/students/verify", cabinetHandler.MyVerification)

		// Кошелёк
		r.Get("/api/v1/wallet", walletHandler.GetWallet)
		r.Get("/api/v1/wallet/operations", cabinetHandler.WalletOperations)
		r.Post("/api/v1/payments/init", paymentHandler.InitiatePayment)

		// Рефералы
		r.Get("/api/v1/referral/code", referralHandler.GetCode)
		r.Get("/api/v1/referral/stats", referralHandler.GetStats)
		r.Get("/api/v1/referral/invitees", cabinetHandler.ReferralInvitees)

		// Подписки на компании
		r.Post("/api/v1/companies/{id}/subscribe", subscriptionHandler.Subscribe)
		r.Delete("/api/v1/companies/{id}/subscribe", subscriptionHandler.Unsubscribe)
		r.Get("/api/v1/subscriptions/companies", subscriptionHandler.MyCompanies)
		r.Get("/api/v1/subscriptions/companies/ids", subscriptionHandler.SubscribedIDs)
		r.Get("/api/v1/subscriptions/overview", cabinetHandler.SubscriptionsOverview)

		// Ивенты
		r.Get("/api/v1/events", eventHandler.List)
		r.Get("/api/v1/events/my", eventHandler.My)
		r.Get("/api/v1/events/meta", cabinetHandler.EventsMeta)
		r.Get("/api/v1/events/friends", cabinetHandler.EventFriends)
		r.Get("/api/v1/events/{id}", eventHandler.Get)
		r.Post("/api/v1/events", eventHandler.Create)
		r.Post("/api/v1/events/{id}/submit", eventHandler.Submit)
		r.Post("/api/v1/events/{id}/schedule", eventHandler.Schedule)
		r.Post("/api/v1/events/{id}/rsvp", eventHandler.SetRSVP)
		r.Delete("/api/v1/events/{id}/schedule", eventHandler.CancelSchedule)

		// Заказы
		r.Post("/api/v1/orders", orderHandler.CreateOrder)
		r.Get("/api/v1/orders", orderHandler.GetUserOrders)
		r.Get("/api/v1/orders/{id}", orderHandler.GetOrder)
		r.Get("/api/v1/orders/{id}/qr", cabinetHandler.OrderQR)
		r.Post("/api/v1/orders/{id}/confirm", orderHandler.ConfirmOrder)
		// UpdateStatus и RefundOrder — ниже, в админ-группе: это операции над ЛЮБЫМ
		// заказом, а не только своим, поэтому они не должны быть доступны рядовому
		// пользователю по одному только Auth (см. CVE-подобный IDOR, который тут был).
		r.Post("/api/v1/orders/{id}/cancel", orderHandler.CancelOrder)

		// Поддержка (пользователь)
		r.Post("/api/v1/support/tickets", supportHandler.CreateTicket)
		r.Get("/api/v1/support/tickets", supportHandler.GetUserTickets)
		r.Get("/api/v1/support/tickets/{id}/messages", supportHandler.GetTicketMessages)
		r.Post("/api/v1/support/tickets/{id}/messages", supportHandler.AddMessage)
		r.Get("/api/v1/support/overview", cabinetHandler.SupportOverview)
		r.Get("/api/v1/support/tickets/{id}/thread", cabinetHandler.SupportThread)
		r.Post("/api/v1/support/tickets/{id}/close", cabinetHandler.SupportClose)

		// Статистика (заглушка)
		r.Get("/api/v1/statistics/student", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"total_saved":1250,"orders_count":12,"top_category":"Еда","bonus_earned":800}`))
		})
		r.Get("/api/v1/statistics/company", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"total_orders":45,"unique_students":28,"avg_check":850,"total_revenue":38250}`))
		})

		// ---- Админ-роуты (только для администраторов) ----
		r.Group(func(r chi.Router) {
			r.Use(middleware.AdminOnly(userRepo))
			r.Use(middleware.AuditLog(auditUsecase))

			// Админ-панель по макетам A01–A10
			adm := cabinetHandler.Admin
			r.Get("/api/v1/admin/counters", adm.Counters)
			r.Get("/api/v1/admin/dashboard", adm.Dashboard)
			r.Get("/api/v1/admin/journal", adm.Journal)
			r.Get("/api/v1/admin/moderation", adm.Moderation)
			r.Get("/api/v1/admin/moderation/{id}", adm.ModerationDetail)
			r.Get("/api/v1/admin/verifications/queue", adm.Verifications)
			r.Get("/api/v1/admin/verifications/{id}", adm.Verification)
			r.Get("/api/v1/admin/users/list", adm.Users)
			r.Get("/api/v1/admin/users/{id}/card", adm.UserCard)
			r.Put("/api/v1/admin/users/{id}/vip", adm.SetVIP)
			r.Put("/api/v1/admin/users/{id}/block", adm.SetBlocked)
			r.Post("/api/v1/admin/users/{id}/reset-verification", adm.ResetVerification)
			r.Get("/api/v1/admin/universities", adm.Universities)
			r.Get("/api/v1/admin/companies/list", adm.Companies)
			r.Post("/api/v1/admin/companies/create", adm.CreateCompany)
			r.Put("/api/v1/admin/companies/{id}/active", adm.SetCompanyActive)
			r.Post("/api/v1/admin/tags", adm.CreateTag)
			r.Post("/api/v1/admin/tags/{id}/approve", adm.ApproveTag)
			r.Post("/api/v1/admin/tags/{id}/reject", adm.RejectTag)
			r.Get("/api/v1/admin/support/queue", adm.Tickets)
			r.Get("/api/v1/admin/support/{id}", adm.Ticket)
			r.Post("/api/v1/admin/support/{id}/note", adm.TicketNote)

			// Пользователи
			r.Get("/api/v1/admin/users", adminHandler.ListUsers)
			r.Put("/api/v1/admin/users/role", adminHandler.UpdateUserRole)
			r.Patch("/api/v1/admin/users/{id}/university", adminHandler.SetUserUniversity)
			r.Get("/api/v1/admin/users/{id}", adminHandler.GetUser)
			r.Get("/api/v1/admin/users/{id}/stats", adminHandler.GetUserDetailedStats)

			// Компании
			r.Get("/api/v1/admin/companies", adminHandler.ListCompanies)
			r.Post("/api/v1/admin/companies", adminHandler.CreateCompany)
			r.Put("/api/v1/admin/companies/{id}", adminHandler.UpdateCompany)
			r.Delete("/api/v1/admin/companies", adminHandler.DeleteCompany)

			// Предложения
			r.Get("/api/v1/admin/offers", adminHandler.ListOffers)
			r.Get("/api/v1/admin/offers/{id}", adminHandler.GetOfferDetail)
			r.Post("/api/v1/admin/offers", adminHandler.CreateOffer)
			r.Put("/api/v1/admin/offers/{id}", adminHandler.UpdateOffer)
			r.Delete("/api/v1/admin/offers", adminHandler.DeleteOffer)
			r.Put("/api/v1/admin/offers/{id}/moderate", adminHandler.ModerateOffer)
			r.Put("/api/v1/admin/offers/{id}/archive", adminHandler.ArchiveOffer)

			// Верификации
			r.Get("/api/v1/admin/verifications", adminHandler.ListVerifications)
			r.Put("/api/v1/admin/verifications/{id}", adminHandler.UpdateVerification)

			// Заказы (управление любым заказом — только админ)
			r.Put("/api/v1/orders/{id}/status", orderHandler.UpdateStatus)
			r.Post("/api/v1/orders/{id}/refund", orderHandler.RefundOrder)

			// Статистика общая
			r.Get("/api/v1/admin/statistics", adminHandler.GetStatistics)
			r.Get("/api/v1/admin/audit-logs", auditHandler.List)
			r.Get("/api/v1/admin/tags", tagHandler.AdminList)
            r.Post("/api/v1/admin/upload", uploadHandler.Upload)

			// Поддержка (админ)
			r.Get("/api/v1/admin/support/tickets", supportHandler.AdminListTickets)
			r.Put("/api/v1/admin/support/tickets/{id}/status", supportHandler.AdminUpdateTicketStatus)
			r.Post("/api/v1/admin/support/tickets/{id}/messages", supportHandler.AdminAddMessage)
		})

		// ---- Партнёрские ----
		r.Group(func(r chi.Router) {
			r.Use(middleware.MerchantOnly(userRepo))
			r.Get("/api/v1/merchant/companies", merchantHandler.GetUserCompanies)
            r.Post("/api/v1/merchant/upload", uploadHandler.Upload)
			r.Get("/api/v1/merchant/offers", merchantHandler.ListOffers)
			r.Post("/api/v1/merchant/offers", merchantHandler.CreateOffer)
            r.Put("/api/v1/merchant/offers/{id}", merchantHandler.UpdateOffer)
			r.Post("/api/v1/merchant/offers/{id}/submit", merchantHandler.SubmitForReview)
			r.Post("/api/v1/merchant/offers/{id}/accept-edits", merchantHandler.AcceptAdminEdits)
			r.Post("/api/v1/merchant/offers/{id}/reject-edits", merchantHandler.RejectAdminEdits)
			r.Get("/api/v1/merchant/statistics/daily", merchantHandler.GetDailyStats)
			r.Get("/api/v1/merchant/balance", merchantHandler.GetBalance)
			r.Get("/api/v1/merchant/transactions", merchantHandler.GetTransactions)
			r.Get("/api/v1/merchant/events/stats", eventHandler.MyEventStats)
			r.Get("/api/v1/merchant/events", eventHandler.MyMerchant)

			// Кабинет партнёра (макет «Чек», P01–P09)
			r.Get("/api/v1/merchant/cabinet/config", cabinetHandler.Config)
			r.Get("/api/v1/merchant/cabinet/overview", cabinetHandler.Overview)
			r.Get("/api/v1/merchant/cabinet/companies", cabinetHandler.Companies)
			r.Get("/api/v1/merchant/cabinet/transactions", cabinetHandler.Transactions)
			r.Get("/api/v1/merchant/cabinet/stats", cabinetHandler.Stats)
			r.Get("/api/v1/merchant/cabinet/offers", cabinetHandler.MerchantOffers)
			r.Get("/api/v1/merchant/cabinet/offers/{id}", cabinetHandler.Offer)
			r.Post("/api/v1/merchant/cabinet/redeem/check", cabinetHandler.RedeemCheck)
			r.Get("/api/v1/merchant/cabinet/redeem/today", cabinetHandler.RedeemToday)
			r.Post("/api/v1/merchant/cabinet/redeem/{id}", cabinetHandler.Redeem)
			r.Post("/api/v1/merchant/cabinet/redeem/{id}/reject", cabinetHandler.RedeemReject)
		})
	})

	return r
}
