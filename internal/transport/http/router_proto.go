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
	userRepo repository.UserRepository,
	jwtManager *crypto.JWTManager,
) *chi.Mux {
	r := chi.NewRouter()
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(middleware.CORS)
	r.Use(middleware.RequestInfo)

	authHandler := handlers.NewAuthHandler(authUsecase)
	userHandler := handlers.NewUserHandler(userUsecase)
	companyHandler := handlers.NewCompanyHandler(companyUsecase)
	orderHandler := handlers.NewOrderHandler(orderUsecase)
	referralHandler := handlers.NewReferralHandler(referralUsecase)

	// Публичные
	r.Post("/api/v1/auth/register", authHandler.Register)
	r.Post("/api/v1/auth/login", authHandler.Login)
	r.Get("/api/v1/companies", companyHandler.ListCompanies)
	r.Get("/api/v1/offers", companyHandler.ListOffers)
    r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir("/app/uploads"))))
	r.Get("/api/v1/offers/nearby", companyHandler.GetNearbyOffers)
	r.Get("/api/v1/companies/{id}/stats", subscriptionHandler.CompanyStats)
    r.Get("/api/v1/tags", tagHandler.List)
	r.Get("/api/v1/tags/popular", tagHandler.Popular)
	r.Get("/api/v1/tags/search", tagHandler.Search)
    r.Get("/api/v1/users/by-username/{username}", userHandler.GetPublicProfile)
	r.Get("/api/v1/users/by-username/{username}/companies", userHandler.GetPublicCompanies)
	r.Get("/api/v1/users/by-username/{username}/events", eventHandler.ByUsername)
	r.Get("/api/v1/users/by-username/{username}/attending", eventHandler.AttendingByUsername)

	// Публичные страницы оплаты (эмуляция СБП)
	r.Get("/payments/sbp/checkout/{id}", paymentHandler.ConfirmPayment)
	r.Post("/payments/sbp/checkout/{id}", paymentHandler.ConfirmPayment)
	r.Post("/payments/sbp/confirm/{id}", paymentHandler.ConfirmPayment)
	r.Post("/api/v1/payments/webhook", paymentHandler.WebhookHandler)

	// Защищённые
	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(jwtManager))

		// Пользователь
		r.Get("/api/v1/users/me", userHandler.GetProfile)

        // Друзья
        r.Get("/api/v1/friends", friendHandler.ListFriends)
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
        r.Post("/api/v1/users/upload-avatar", uploadHandler.Upload)
		r.Get("/api/v1/users/transactions", userHandler.GetTransactionHistory)
		r.Get("/api/v1/notifications/stream", notificationHandler.Stream)
		r.Get("/api/v1/notifications", notificationHandler.List)
		r.Get("/api/v1/notifications/unread/count", notificationHandler.CountUnread)
		r.Post("/api/v1/notifications/{id}/read", notificationHandler.MarkRead)
		r.Delete("/api/v1/notifications/{id}", notificationHandler.Delete)
		r.Post("/api/v1/notifications/read-all", notificationHandler.MarkAllRead)
		r.Get("/api/v1/users/me/notification-settings", notificationHandler.GetSettings)
		r.Patch("/api/v1/users/me/notification-settings", notificationHandler.UpdateSettings)

		// Верификация
		r.Post("/api/v1/students/verify", authHandler.RequestVerification)

		// Кошелёк
		r.Get("/api/v1/wallet", walletHandler.GetWallet)
		r.Post("/api/v1/payments/init", paymentHandler.InitiatePayment)

		// Рефералы
		r.Get("/api/v1/referral/code", referralHandler.GetCode)
		r.Get("/api/v1/referral/stats", referralHandler.GetStats)

		// Подписки на компании
		r.Post("/api/v1/companies/{id}/subscribe", subscriptionHandler.Subscribe)
		r.Delete("/api/v1/companies/{id}/subscribe", subscriptionHandler.Unsubscribe)
		r.Get("/api/v1/subscriptions/companies", subscriptionHandler.MyCompanies)
		r.Get("/api/v1/subscriptions/companies/ids", subscriptionHandler.SubscribedIDs)

		// Ивенты
		r.Get("/api/v1/events", eventHandler.List)
		r.Get("/api/v1/events/my", eventHandler.My)
		r.Get("/api/v1/events/{id}", eventHandler.Get)
		r.Post("/api/v1/events", eventHandler.Create)
		r.Post("/api/v1/events/{id}/submit", eventHandler.Submit)
		r.Post("/api/v1/events/{id}/schedule", eventHandler.Schedule)
		r.Delete("/api/v1/events/{id}/schedule", eventHandler.CancelSchedule)

		// Заказы
		r.Post("/api/v1/orders", orderHandler.CreateOrder)
		r.Get("/api/v1/orders", orderHandler.GetUserOrders)
		r.Get("/api/v1/orders/{id}", orderHandler.GetOrder)
		r.Post("/api/v1/orders/{id}/confirm", orderHandler.ConfirmOrder)
		r.Put("/api/v1/orders/{id}/status", orderHandler.UpdateStatus)
		r.Post("/api/v1/orders/{id}/refund", orderHandler.RefundOrder)
		r.Post("/api/v1/orders/{id}/cancel", orderHandler.CancelOrder)

		// Поддержка (пользователь)
		r.Post("/api/v1/support/tickets", supportHandler.CreateTicket)
		r.Get("/api/v1/support/tickets", supportHandler.GetUserTickets)
		r.Get("/api/v1/support/tickets/{id}/messages", supportHandler.GetTicketMessages)
		r.Post("/api/v1/support/tickets/{id}/messages", supportHandler.AddMessage)

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

			// Пользователи
			r.Get("/api/v1/admin/users", adminHandler.ListUsers)
			r.Put("/api/v1/admin/users/role", adminHandler.UpdateUserRole)
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
			r.Get("/api/v1/merchant/events", eventHandler.MyMerchant)
		})
	})

	return r
}
