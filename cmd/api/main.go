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

	// Репозитории
	userRepo := postgres.NewUserRepo(db)
	sessionRepo := &postgres.SessionRepo{}
	studentVerifRepo := postgres.NewStudentVerificationRepo(db)
	uniRepo := &postgres.UniversityRepo{}
	orderRepo := postgres.NewOrderRepo(db)
	accountRepo := postgres.NewAccountRepo(db)
	ledgerRepo := postgres.NewLedgerRepo(db)
	bonusRepo := postgres.NewBonusRepo(db)
	referralRepo := postgres.NewReferralRepo(db)
	companyRepo := postgres.NewCompanyRepo(db)
	locationRepo := postgres.NewLocationRepo(db)
	offerRepo := postgres.NewOfferRepo(db)
	ticketRepo := postgres.NewSupportTicketRepo(db)
	msgRepo := postgres.NewSupportMessageRepo(db)
	companyUserRepo := postgres.NewCompanyUserRepo(db)
	paymentRepo := postgres.NewPaymentRepo(db)
	merchantAccountRepo := postgres.NewMerchantAccountRepo(db)
	merchantTxRepo := postgres.NewMerchantTransactionRepo(db)
	//settlementRepo := postgres.NewSettlementRepo(db)

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
	orderUsecase := usecase.NewOrderUsecase(orderRepo, offerRepo, userRepo, accountRepo, ledgerRepo, bonusRepo, merchantAccountRepo, merchantTxRepo, db.Pool)
	paymentUsecase := usecase.NewPaymentUsecase(accountRepo, ledgerRepo, bonusRepo, paymentRepo)
	referralUsecase := usecase.NewReferralUsecase(referralRepo, userRepo)
	supportUsecase := usecase.NewSupportUsecase(ticketRepo, msgRepo, userRepo)
	adminUsecase := usecase.NewAdminUsecase(userRepo, companyRepo, locationRepo, offerRepo, studentVerifRepo, accountRepo, bonusRepo, referralRepo, db.Pool)
	merchantUsecase := usecase.NewMerchantUsecase(companyRepo, locationRepo, offerRepo, companyUserRepo, userRepo, merchantAccountRepo, merchantTxRepo, db.Pool)

	// Handlers
	walletHandler := handlers.NewWalletHandler(accountRepo, bonusRepo)
	adminHandler := handlers.NewAdminHandler(adminUsecase)
	supportHandler := handlers.NewSupportHandler(supportUsecase)
	merchantHandler := handlers.NewMerchantHandler(merchantUsecase)
	paymentHandler := handlers.NewPaymentHandler(paymentUsecase)

	router := transport.NewRouterProto(
		authUsecase,
		userUsecase,
		companyUsecase,
		orderUsecase,
		paymentUsecase,
		referralUsecase,
		supportUsecase,
		merchantUsecase,
		walletHandler,
		adminHandler,
		supportHandler,
		merchantHandler,
		paymentHandler,
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
