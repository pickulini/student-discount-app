package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "time"

    "your-project/internal/config"
    "your-project/internal/infrastructure/crypto"
    "your-project/internal/repository/postgres"
    transport "your-project/internal/transport/http"
    "your-project/internal/transport/http/handlers"
    "your-project/internal/usecase"
)

func main() {
    cfg := config.Load()

    ctx := context.Background()
    db, err := postgres.NewDB(ctx, cfg.DatabaseURL)
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    // Все репозитории — PostgreSQL
    userRepo := postgres.NewUserRepo(db)
    sessionRepo := &postgres.SessionRepo{}
    studentVerifRepo := postgres.NewStudentVerificationRepo(db)
    uniRepo := &postgres.UniversityRepo{}
    orderRepo := postgres.NewOrderRepo(db)  // теперь реальный
    accountRepo := postgres.NewAccountRepo(db)
    ledgerRepo := postgres.NewLedgerRepo(db)
    bonusRepo := postgres.NewBonusRepo(db)
    referralRepo := postgres.NewReferralRepo(db)
    companyRepo := postgres.NewCompanyRepo(db)
    locationRepo := postgres.NewLocationRepo(db)
    offerRepo := postgres.NewOfferRepo(db)

    hasher := crypto.NewPasswordHasher(cfg.Argon2Time, cfg.Argon2Memory, cfg.Argon2Threads, cfg.Argon2KeyLen)
    jwtManager := crypto.NewJWTManager(cfg.JWTSecret, cfg.JWTExpiryMin)

    // Usecases
    authUsecase := usecase.NewAuthUsecase(
        userRepo, sessionRepo, studentVerifRepo, uniRepo,
        accountRepo, bonusRepo, referralRepo,
        hasher, jwtManager, cfg.FrontendURL,
    )
    userUsecase := usecase.NewUserUsecase(userRepo, accountRepo, bonusRepo, ledgerRepo)
    companyUsecase := usecase.NewCompanyUsecase(companyRepo, locationRepo, offerRepo)
    orderUsecase := usecase.NewOrderUsecase(orderRepo, offerRepo, userRepo, accountRepo, ledgerRepo, bonusRepo)
    paymentUsecase := usecase.NewPaymentUsecase(accountRepo, ledgerRepo, bonusRepo)
    referralUsecase := usecase.NewReferralUsecase(referralRepo, userRepo)
    adminUsecase := usecase.NewAdminUsecase(userRepo, companyRepo, locationRepo, offerRepo, studentVerifRepo, db.Pool)

    walletHandler := handlers.NewWalletHandler(accountRepo, bonusRepo)
    adminHandler := handlers.NewAdminHandler(adminUsecase)

    router := transport.NewRouterProto(
        authUsecase,
        userUsecase,
        companyUsecase,
        orderUsecase,
        paymentUsecase,
        referralUsecase,
        walletHandler,
        adminHandler,
        userRepo,
        jwtManager,
    )

    srv := &http.Server{
        Addr:         cfg.AppPort,
        Handler:      router,
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 15 * time.Second,
    }

    go func() {
        log.Printf("Server started on %s", cfg.AppPort)
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatal(err)
        }
    }()

    quit := make(chan os.Signal, 1)
    signal.Notify(quit, os.Interrupt)
    <-quit
    ctxShutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := srv.Shutdown(ctxShutdown); err != nil {
        log.Fatal("Server forced shutdown:", err)
    }
}
