package http

import (
    "net/http"
    "github.com/go-chi/chi/v5"
    chiMiddleware "github.com/go-chi/chi/v5/middleware"
    "your-project/internal/transport/http/handlers"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
    "your-project/internal/infrastructure/crypto"
    "your-project/internal/repository"
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
    userRepo repository.UserRepository,
    jwtManager *crypto.JWTManager,
) *chi.Mux {
    r := chi.NewRouter()
    r.Use(chiMiddleware.Logger)
    r.Use(chiMiddleware.Recoverer)
    r.Use(middleware.CORS)

    authHandler := handlers.NewAuthHandler(authUsecase)
    userHandler := handlers.NewUserHandler(userUsecase)
    companyHandler := handlers.NewCompanyHandler(companyUsecase)
    orderHandler := handlers.NewOrderHandler(orderUsecase)
    paymentHandler := handlers.NewPaymentHandler(paymentUsecase)
    referralHandler := handlers.NewReferralHandler(referralUsecase)

    // Публичные
    r.Post("/api/v1/auth/register", authHandler.Register)
    r.Post("/api/v1/auth/login", authHandler.Login)
    r.Get("/api/v1/companies", companyHandler.ListCompanies)
    r.Get("/api/v1/offers", companyHandler.ListOffers)
    r.Get("/api/v1/offers/nearby", companyHandler.GetNearbyOffers)

    // Защищённые
    r.Group(func(r chi.Router) {
        r.Use(middleware.Auth(jwtManager))

        // Пользователь
        r.Get("/api/v1/users/me", userHandler.GetProfile)
        r.Get("/api/v1/users/transactions", userHandler.GetTransactionHistory)

        // Верификация
        r.Post("/api/v1/students/verify", authHandler.RequestVerification)

        // Кошелёк
        r.Get("/api/v1/wallet", walletHandler.GetWallet)
        r.Post("/api/v1/payments/deposit", paymentHandler.Deposit)

        // Рефералы
        r.Get("/api/v1/referral/code", referralHandler.GetCode)
        r.Get("/api/v1/referral/stats", referralHandler.GetStats)

        // Заказы
        r.Post("/api/v1/orders", orderHandler.CreateOrder)
        r.Get("/api/v1/orders", orderHandler.GetUserOrders)

        // Поддержка
        r.Post("/api/v1/support/tickets", supportHandler.CreateTicket)
        r.Get("/api/v1/support/tickets", supportHandler.GetUserTickets)
        r.Get("/api/v1/support/tickets/{id}/messages", supportHandler.GetTicketMessages)
        r.Post("/api/v1/support/tickets/{id}/messages", supportHandler.AddMessage)

        // Партнёр
        r.Group(func(r chi.Router) {
            r.Use(middleware.MerchantOnly(userRepo))
            r.Get("/api/v1/merchant/companies", merchantHandler.GetUserCompanies)
            r.Get("/api/v1/merchant/offers", merchantHandler.ListOffers)
    r.Post("/api/v1/merchant/offers/{id}/submit", merchantHandler.SubmitForReview)
            r.Post("/api/v1/merchant/offers", merchantHandler.CreateOffer)
            r.Get("/api/v1/merchant/statistics/daily", merchantHandler.GetDailyStats)
        })

        // Статистика (заглушка)
        r.Get("/api/v1/statistics/student", func(w http.ResponseWriter, r *http.Request) {
            w.Write([]byte(`{"total_saved":1250,"orders_count":12,"top_category":"Еда","bonus_earned":800}`))
        })
        r.Get("/api/v1/statistics/company", func(w http.ResponseWriter, r *http.Request) {
            w.Write([]byte(`{"total_orders":45,"unique_students":28,"avg_check":850,"total_revenue":38250}`))
        })

        // ---- Админ-роуты ----
        r.Group(func(r chi.Router) {
            r.Use(middleware.AdminOnly(userRepo))

            r.Get("/api/v1/admin/users", adminHandler.ListUsers)
            r.Put("/api/v1/admin/users/role", adminHandler.UpdateUserRole)
            r.Get("/api/v1/admin/users/{id}", adminHandler.GetUser)
            r.Get("/api/v1/admin/users/{id}/stats", adminHandler.GetUserDetailedStats)

            r.Get("/api/v1/admin/companies", adminHandler.ListCompanies)
            r.Post("/api/v1/admin/companies", adminHandler.CreateCompany)
            r.Put("/api/v1/admin/companies/{id}", adminHandler.UpdateCompany)
            r.Delete("/api/v1/admin/companies", adminHandler.DeleteCompany)

            r.Get("/api/v1/admin/offers", adminHandler.ListOffers)
            r.Post("/api/v1/admin/offers", adminHandler.CreateOffer)
            r.Put("/api/v1/admin/offers/{id}", adminHandler.UpdateOffer)
            r.Put("/api/v1/admin/offers/{id}/moderate", adminHandler.ModerateOffer)
    r.Put("/api/v1/admin/offers/{id}/moderate", adminHandler.ModerateOffer)
            r.Put("/api/v1/admin/offers/{id}/moderate", adminHandler.ModerateOffer)
            r.Delete("/api/v1/admin/offers", adminHandler.DeleteOffer)

            r.Get("/api/v1/admin/verifications", adminHandler.ListVerifications)
            r.Put("/api/v1/admin/verifications/{id}", adminHandler.UpdateVerification)

            r.Get("/api/v1/admin/statistics", adminHandler.GetStatistics)

            r.Get("/api/v1/admin/support/tickets", supportHandler.AdminListTickets)
            r.Put("/api/v1/admin/support/tickets/{id}/status", supportHandler.AdminUpdateTicketStatus)
            r.Post("/api/v1/admin/support/tickets/{id}/messages", supportHandler.AdminAddMessage)
        })
    })

    return r
}
