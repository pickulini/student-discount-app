#!/bin/bash
set -e

echo "Добавляем прототип-функциональность..."

# 1. Модели для прототипа (компании, предложения, заказы)
cat > internal/domain/company.go << 'DOMAIN_COMPANY'
package domain

import "time"

type Company struct {
    ID        int64     `json:"id"`
    Name      string    `json:"name"`
    Description string  `json:"description"`
    Logo      string    `json:"logo"`
    Website   string    `json:"website"`
    Phone     string    `json:"phone"`
    CategoryID int64    `json:"category_id"`
    IsActive  bool      `json:"is_active"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type CompanyLocation struct {
    ID        int64     `json:"id"`
    CompanyID int64     `json:"company_id"`
    Address   string    `json:"address"`
    Latitude  float64   `json:"latitude"`
    Longitude float64   `json:"longitude"`
    Phone     string    `json:"phone"`
    IsActive  bool      `json:"is_active"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type Category struct {
    ID       int64  `json:"id"`
    Name     string `json:"name"`
    Slug     string `json:"slug"`
    ParentID *int64 `json:"parent_id,omitempty"`
    IsActive bool   `json:"is_active"`
}

type Offer struct {
    ID              int64      `json:"id"`
    CompanyID       int64      `json:"company_id"`
    Title           string     `json:"title"`
    Description     string     `json:"description"`
    DiscountType    string     `json:"discount_type"` // percentage, fixed
    DiscountValue   float64    `json:"discount_value"`
    SpecialPrice    *float64   `json:"special_price,omitempty"`
    StartAt         time.Time  `json:"start_at"`
    EndAt           time.Time  `json:"end_at"`
    Status          string     `json:"status"` // draft, pending, published, paused, expired
    MaxUses         *int       `json:"max_uses,omitempty"`
    CurrentUses     int        `json:"current_uses"`
    BonusAllowed    bool       `json:"bonus_allowed"`
    MaxBonusPercent int        `json:"max_bonus_percent"`
    CreatedAt       time.Time  `json:"created_at"`
    UpdatedAt       time.Time  `json:"updated_at"`
}
DOMAIN_COMPANY

cat > internal/domain/order.go << 'DOMAIN_ORDER'
package domain

import "time"

type Order struct {
    ID             int64     `json:"id"`
    UserID         int64     `json:"user_id"`
    CompanyID      int64     `json:"company_id"`
    LocationID     *int64    `json:"location_id,omitempty"`
    OfferID        int64     `json:"offer_id"`
    Subtotal       float64   `json:"subtotal"`
    DiscountAmount float64   `json:"discount_amount"`
    BonusAmount    float64   `json:"bonus_amount"`
    TotalAmount    float64   `json:"total_amount"`
    Commission     float64   `json:"commission"`
    Status         string    `json:"status"` // created, paid, completed, cancelled, refunded
    CreatedAt      time.Time `json:"created_at"`
    CompletedAt    *time.Time `json:"completed_at,omitempty"`
    CancelledAt    *time.Time `json:"cancelled_at,omitempty"`
}
DOMAIN_ORDER

# 2. Добавляем интерфейсы репозиториев для новых сущностей
cat >> internal/repository/interfaces.go << 'REPO_INTERFACES'

type CompanyRepository interface {
    Create(ctx context.Context, c *domain.Company) error
    GetByID(ctx context.Context, id int64) (*domain.Company, error)
    List(ctx context.Context, limit, offset int) ([]domain.Company, error)
}

type LocationRepository interface {
    Create(ctx context.Context, l *domain.CompanyLocation) error
    GetByCompanyID(ctx context.Context, companyID int64) ([]domain.CompanyLocation, error)
    GetNearby(ctx context.Context, lat, lng float64, radius int) ([]domain.CompanyLocation, error)
}

type OfferRepository interface {
    Create(ctx context.Context, o *domain.Offer) error
    GetByID(ctx context.Context, id int64) (*domain.Offer, error)
    List(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]domain.Offer, error)
    GetActiveOffers(ctx context.Context) ([]domain.Offer, error)
    IncrementUses(ctx context.Context, id int64) error
}

type OrderRepository interface {
    Create(ctx context.Context, o *domain.Order) error
    GetByID(ctx context.Context, id int64) (*domain.Order, error)
    GetByUserID(ctx context.Context, userID int64) ([]domain.Order, error)
    UpdateStatus(ctx context.Context, id int64, status string) error
}
REPO_INTERFACES

# 3. Заглушки репозиториев (in-memory для прототипа)
cat > internal/repository/memory/company_repo.go << 'MEMORY_COMPANY'
package memory

import (
    "context"
    "sync"
    "your-project/internal/domain"
)

type CompanyRepo struct {
    mu    sync.RWMutex
    store map[int64]domain.Company
    idSeq int64
}

func NewCompanyRepo() *CompanyRepo {
    return &CompanyRepo{
        store: make(map[int64]domain.Company),
        idSeq: 1,
    }
}

func (r *CompanyRepo) Create(ctx context.Context, c *domain.Company) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    c.ID = r.idSeq
    r.store[r.idSeq] = *c
    r.idSeq++
    return nil
}

func (r *CompanyRepo) GetByID(ctx context.Context, id int64) (*domain.Company, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    if c, ok := r.store[id]; ok {
        return &c, nil
    }
    return nil, domain.ErrUserNotFound
}

func (r *CompanyRepo) List(ctx context.Context, limit, offset int) ([]domain.Company, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    result := []domain.Company{}
    for _, c := range r.store {
        result = append(result, c)
    }
    if len(result) > limit {
        result = result[:limit]
    }
    return result, nil
}
MEMORY_COMPANY

# 4. Usecase для компаний и предложений (с заглушками)
cat > internal/usecase/company.go << 'USECASE_COMPANY'
package usecase

import (
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type CompanyUsecase struct {
    companyRepo  repository.CompanyRepository
    locationRepo repository.LocationRepository
    offerRepo    repository.OfferRepository
}

func NewCompanyUsecase(
    companyRepo repository.CompanyRepository,
    locationRepo repository.LocationRepository,
    offerRepo repository.OfferRepository,
) *CompanyUsecase {
    return &CompanyUsecase{
        companyRepo:  companyRepo,
        locationRepo: locationRepo,
        offerRepo:    offerRepo,
    }
}

func (u *CompanyUsecase) ListCompanies(ctx context.Context, limit, offset int) ([]domain.Company, error) {
    return u.companyRepo.List(ctx, limit, offset)
}

func (u *CompanyUsecase) GetCompany(ctx context.Context, id int64) (*domain.Company, error) {
    return u.companyRepo.GetByID(ctx, id)
}

func (u *CompanyUsecase) GetLocations(ctx context.Context, companyID int64) ([]domain.CompanyLocation, error) {
    return u.locationRepo.GetByCompanyID(ctx, companyID)
}

func (u *CompanyUsecase) ListOffers(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]domain.Offer, error) {
    return u.offerRepo.List(ctx, filters, limit, offset)
}

func (u *CompanyUsecase) GetOffer(ctx context.Context, id int64) (*domain.Offer, error) {
    return u.offerRepo.GetByID(ctx, id)
}
USECASE_COMPANY

# 5. Usecase для заказов (с расчетами)
cat > internal/usecase/order.go << 'USECASE_ORDER'
package usecase

import (
    "context"
    "errors"
    "math"
    "time"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type OrderUsecase struct {
    orderRepo   repository.OrderRepository
    offerRepo   repository.OfferRepository
    userRepo    repository.UserRepository
}

func NewOrderUsecase(
    orderRepo repository.OrderRepository,
    offerRepo repository.OfferRepository,
    userRepo repository.UserRepository,
) *OrderUsecase {
    return &OrderUsecase{
        orderRepo: orderRepo,
        offerRepo: offerRepo,
        userRepo:  userRepo,
    }
}

type CreateOrderInput struct {
    UserID      int64
    OfferID     int64
    LocationID  *int64
    BonusPoints float64
}

func (u *OrderUsecase) CreateOrder(ctx context.Context, input CreateOrderInput) (*domain.Order, error) {
    // 1. Получаем предложение
    offer, err := u.offerRepo.GetByID(ctx, input.OfferID)
    if err != nil {
        return nil, errors.New("offer not found")
    }

    // 2. Проверяем активность
    if offer.Status != "published" {
        return nil, errors.New("offer not available")
    }
    if time.Now().After(offer.EndAt) {
        return nil, errors.New("offer expired")
    }

    // 3. Получаем пользователя
    user, err := u.userRepo.GetByID(ctx, input.UserID)
    if err != nil {
        return nil, errors.New("user not found")
    }

    // 4. Рассчитываем стоимость (заглушка: фиксированная цена 1000)
    subtotal := 1000.0
    discount := 0.0
    if offer.DiscountType == "percentage" {
        discount = subtotal * (offer.DiscountValue / 100)
    } else {
        discount = offer.DiscountValue
    }
    afterDiscount := subtotal - discount

    // 5. Бонусы (не более 20% от суммы)
    maxBonusPercent := 20
    maxBonus := afterDiscount * float64(maxBonusPercent) / 100
    bonusUsed := math.Min(input.BonusPoints, maxBonus)

    total := afterDiscount - bonusUsed

    // 6. Комиссия платформы (2%)
    commission := total * 0.02

    // 7. Проверяем баланс
    if total > user.Balance {
        return nil, domain.ErrInsufficientBalance
    }

    // 8. Создаём заказ
    order := &domain.Order{
        UserID:         input.UserID,
        OfferID:        input.OfferID,
        LocationID:     input.LocationID,
        Subtotal:       subtotal,
        DiscountAmount: discount,
        BonusAmount:    bonusUsed,
        TotalAmount:    total,
        Commission:     commission,
        Status:         "created",
        CreatedAt:      time.Now(),
    }

    if err := u.orderRepo.Create(ctx, order); err != nil {
        return nil, err
    }

    // 9. Списываем деньги (заглушка — обновляем баланс)
    newBalance := user.Balance - total
    if err := u.userRepo.UpdateBalance(ctx, user.ID, newBalance); err != nil {
        return nil, err
    }

    // 10. Увеличиваем счётчик использований
    u.offerRepo.IncrementUses(ctx, offer.ID)

    return order, nil
}

func (u *OrderUsecase) GetUserOrders(ctx context.Context, userID int64) ([]domain.Order, error) {
    return u.orderRepo.GetByUserID(ctx, userID)
}
USECASE_ORDER

# 6. HTTP handlers для нового функционала
cat > internal/transport/http/handlers/company.go << 'HANDLER_COMPANY'
package handlers

import (
    "net/http"
    "strconv"
    "your-project/internal/usecase"
)

type CompanyHandler struct {
    companyUsecase *usecase.CompanyUsecase
}

func NewCompanyHandler(cu *usecase.CompanyUsecase) *CompanyHandler {
    return &CompanyHandler{companyUsecase: cu}
}

func (h *CompanyHandler) ListCompanies(w http.ResponseWriter, r *http.Request) {
    companies, err := h.companyUsecase.ListCompanies(r.Context(), 100, 0)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load companies")
        return
    }
    writeJSON(w, http.StatusOK, companies)
}

func (h *CompanyHandler) GetCompany(w http.ResponseWriter, r *http.Request) {
    id, _ := strconv.ParseInt(r.URL.Query().Get("id"), 10, 64)
    company, err := h.companyUsecase.GetCompany(r.Context(), id)
    if err != nil {
        writeError(w, http.StatusNotFound, "company not found")
        return
    }
    writeJSON(w, http.StatusOK, company)
}

func (h *CompanyHandler) ListOffers(w http.ResponseWriter, r *http.Request) {
    filters := map[string]interface{}{}
    if r.URL.Query().Get("category") != "" {
        filters["category"] = r.URL.Query().Get("category")
    }
    offers, err := h.companyUsecase.ListOffers(r.Context(), filters, 50, 0)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load offers")
        return
    }
    writeJSON(w, http.StatusOK, offers)
}

func (h *CompanyHandler) GetNearbyOffers(w http.ResponseWriter, r *http.Request) {
    lat, _ := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
    lng, _ := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
    radius, _ := strconv.Atoi(r.URL.Query().Get("radius"))
    if radius == 0 {
        radius = 5000
    }
    // Заглушка: возвращаем все активные предложения с координатами
    offers, _ := h.companyUsecase.ListOffers(r.Context(), nil, 20, 0)
    // Добавим фиктивные координаты для демо
    type NearbyOffer struct {
        domain.Offer
        Lat  float64 `json:"lat"`
        Lng  float64 `json:"lng"`
        Dist int     `json:"distance"`
    }
    result := []NearbyOffer{}
    for i, o := range offers {
        if i > 10 {
            break
        }
        result = append(result, NearbyOffer{
            Offer: o,
            Lat:   lat + float64(i)*0.001,
            Lng:   lng + float64(i)*0.001,
            Dist:  i * 100,
        })
    }
    writeJSON(w, http.StatusOK, result)
}
HANDLER_COMPANY

cat > internal/transport/http/handlers/order.go << 'HANDLER_ORDER'
package handlers

import (
    "encoding/json"
    "net/http"
    "your-project/internal/domain"
    "your-project/internal/usecase"
)

type OrderHandler struct {
    orderUsecase *usecase.OrderUsecase
}

func NewOrderHandler(ou *usecase.OrderUsecase) *OrderHandler {
    return &OrderHandler{orderUsecase: ou}
}

type CreateOrderRequest struct {
    OfferID     int64   `json:"offer_id"`
    LocationID  *int64  `json:"location_id,omitempty"`
    BonusPoints float64 `json:"bonus_points"`
}

func (h *OrderHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
    var req CreateOrderRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }

    // Получаем user_id из контекста (установлен middleware.Auth)
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }

    input := usecase.CreateOrderInput{
        UserID:      userID,
        OfferID:     req.OfferID,
        LocationID:  req.LocationID,
        BonusPoints: req.BonusPoints,
    }

    order, err := h.orderUsecase.CreateOrder(r.Context(), input)
    if err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusCreated, order)
}

func (h *OrderHandler) GetUserOrders(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    orders, err := h.orderUsecase.GetUserOrders(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load orders")
        return
    }
    writeJSON(w, http.StatusOK, orders)
}
HANDLER_ORDER

# 7. Добавляем эндпоинты в роутер (модифицируем router.go)
# Создаем новый роутер с дополнительными маршрутами
cat > internal/transport/http/router_proto.go << 'ROUTER_PROTO'
package http

import (
    "net/http"
    "github.com/go-chi/chi/v5"
    chiMiddleware "github.com/go-chi/chi/v5/middleware"
    "your-project/internal/transport/http/handlers"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
    "your-project/internal/infrastructure/crypto"
)

func NewRouterProto(
    authUsecase *usecase.AuthUsecase,
    companyUsecase *usecase.CompanyUsecase,
    orderUsecase *usecase.OrderUsecase,
    jwtManager *crypto.JWTManager,
) *chi.Mux {
    r := chi.NewRouter()
    r.Use(chiMiddleware.Logger)
    r.Use(chiMiddleware.Recoverer)
    r.Use(middleware.CORS)

    authHandler := handlers.NewAuthHandler(authUsecase)
    companyHandler := handlers.NewCompanyHandler(companyUsecase)
    orderHandler := handlers.NewOrderHandler(orderUsecase)

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
        r.Get("/api/v1/users/me", func(w http.ResponseWriter, r *http.Request) {
            // Возвращаем профиль из контекста (заглушка)
            w.Write([]byte(`{"message":"profile"}`))
        })

        // Верификация (заглушка)
        r.Post("/api/v1/students/verify", func(w http.ResponseWriter, r *http.Request) {
            // Просто меняем статус на verified (заглушка)
            w.Write([]byte(`{"status":"verified"}`))
        })

        // Баланс (заглушка)
        r.Get("/api/v1/wallet", func(w http.ResponseWriter, r *http.Request) {
            w.Write([]byte(`{"balance":5000,"bonus":1250}`))
        })

        // Пополнение (заглушка)
        r.Post("/api/v1/payments/deposit", func(w http.ResponseWriter, r *http.Request) {
            w.Write([]byte(`{"status":"success","amount":1000,"new_balance":6000}`))
        })

        // Реферальная система
        r.Get("/api/v1/referral/code", func(w http.ResponseWriter, r *http.Request) {
            w.Write([]byte(`{"code":"ABC123","invites":3,"bonus_earned":300}`))
        })
        r.Get("/api/v1/referral/stats", func(w http.ResponseWriter, r *http.Request) {
            w.Write([]byte(`{"total_invites":5,"active":3,"bonus_total":500}`))
        })

        // Заказы
        r.Post("/api/v1/orders", orderHandler.CreateOrder)
        r.Get("/api/v1/orders", orderHandler.GetUserOrders)

        // Статистика (заглушка)
        r.Get("/api/v1/statistics/student", func(w http.ResponseWriter, r *http.Request) {
            w.Write([]byte(`{"total_saved":1250,"orders_count":12,"top_category":"Еда","bonus_earned":800}`))
        })
        r.Get("/api/v1/statistics/company", func(w http.ResponseWriter, r *http.Request) {
            // Заглушка для компаний
            w.Write([]byte(`{"total_orders":45,"unique_students":28,"avg_check":850,"total_revenue":38250}`))
        })
    })

    return r
}
ROUTER_PROTO

# 8. Обновляем main.go для использования нового роутера
cat > cmd/api/main.go << 'MAIN_PROTO'
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
    "your-project/internal/repository/memory"
    transport "your-project/internal/transport/http"
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

    // Репозитории PostgreSQL
    userRepo := postgres.NewUserRepo(db)
    sessionRepo := &postgres.SessionRepo{}
    studentVerifRepo := &postgres.StudentVerificationRepo{}
    uniRepo := &postgres.UniversityRepo{}
    orderRepo := &postgres.OrderRepo{} // заглушка

    // Репозитории in-memory для прототипа
    companyRepo := memory.NewCompanyRepo()
    locationRepo := memory.NewLocationRepo()
    offerRepo := memory.NewOfferRepo()

    // Заполняем тестовыми данными
    seedDemoData(companyRepo, locationRepo, offerRepo)

    // Crypto
    hasher := crypto.NewPasswordHasher(cfg.Argon2Time, cfg.Argon2Memory, cfg.Argon2Threads, cfg.Argon2KeyLen)
    jwtManager := crypto.NewJWTManager(cfg.JWTSecret, cfg.JWTExpiryMin)

    // Usecases
    authUsecase := usecase.NewAuthUsecase(userRepo, sessionRepo, studentVerifRepo, uniRepo, hasher, jwtManager, cfg.FrontendURL)
    companyUsecase := usecase.NewCompanyUsecase(companyRepo, locationRepo, offerRepo)
    orderUsecase := usecase.NewOrderUsecase(orderRepo, offerRepo, userRepo)

    // Router (используем прото-версию)
    router := transport.NewRouterProto(authUsecase, companyUsecase, orderUsecase, jwtManager)

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

// Функция для заполнения демо-данными
func seedDemoData(companyRepo *memory.CompanyRepo, locationRepo *memory.LocationRepo, offerRepo *memory.OfferRepo) {
    // Компании
    companies := []struct {
        name, desc string
        category   string
    }{
        {"Кофейня "Уют"", "Лучший кофе в городе", "Еда"},
        {"Пицца "Мама"", "Итальянская кухня", "Еда"},
        {"Кинотеатр "Космос"", "Новинки кино", "Развлечения"},
        {"Спортзал "Фитнес"", "Тренажёрный зал", "Спорт"},
    }
    for _, c := range companies {
        comp := &domain.Company{Name: c.name, Description: c.desc, IsActive: true}
        companyRepo.Create(context.Background(), comp)
    }
    // Тут можно добавить локации и предложения
}
MAIN_PROTO

# 9. Добавляем недостающие заглушки для репозиториев
cat > internal/repository/postgres/order_repo.go << 'ORDER_REPO'
package postgres

import (
    "context"
    "your-project/internal/domain"
)

type OrderRepo struct{}

func (r *OrderRepo) Create(ctx context.Context, o *domain.Order) error { return nil }
func (r *OrderRepo) GetByID(ctx context.Context, id int64) (*domain.Order, error) { return nil, nil }
func (r *OrderRepo) GetByUserID(ctx context.Context, userID int64) ([]domain.Order, error) { return []domain.Order{}, nil }
func (r *OrderRepo) UpdateStatus(ctx context.Context, id int64, status string) error { return nil }
ORDER_REPO

cat > internal/repository/memory/location_repo.go << 'MEMORY_LOCATION'
package memory

import (
    "context"
    "sync"
    "your-project/internal/domain"
)

type LocationRepo struct {
    mu    sync.RWMutex
    store map[int64]domain.CompanyLocation
    idSeq int64
}

func NewLocationRepo() *LocationRepo {
    return &LocationRepo{store: make(map[int64]domain.CompanyLocation), idSeq: 1}
}
func (r *LocationRepo) Create(ctx context.Context, l *domain.CompanyLocation) error { return nil }
func (r *LocationRepo) GetByCompanyID(ctx context.Context, companyID int64) ([]domain.CompanyLocation, error) { return []domain.CompanyLocation{}, nil }
func (r *LocationRepo) GetNearby(ctx context.Context, lat, lng float64, radius int) ([]domain.CompanyLocation, error) { return []domain.CompanyLocation{}, nil }
MEMORY_LOCATION

cat > internal/repository/memory/offer_repo.go << 'MEMORY_OFFER'
package memory

import (
    "context"
    "sync"
    "time"
    "your-project/internal/domain"
)

type OfferRepo struct {
    mu    sync.RWMutex
    store map[int64]domain.Offer
    idSeq int64
}

func NewOfferRepo() *OfferRepo {
    r := &OfferRepo{store: make(map[int64]domain.Offer), idSeq: 1}
    // Заполняем демо-предложениями
    now := time.Now()
    offers := []domain.Offer{
        {Title: "Скидка 20% на кофе", Description: "Всё меню", DiscountType: "percentage", DiscountValue: 20, StartAt: now, EndAt: now.AddDate(0, 1, 0), Status: "published", BonusAllowed: true, MaxBonusPercent: 20},
        {Title: "Пицца со скидкой 15%", Description: "На любую пиццу", DiscountType: "percentage", DiscountValue: 15, StartAt: now, EndAt: now.AddDate(0, 0, 15), Status: "published", BonusAllowed: false},
        {Title: "Кино со скидкой 100 руб", Description: "На любой сеанс", DiscountType: "fixed", DiscountValue: 100, StartAt: now, EndAt: now.AddDate(0, 0, 7), Status: "published", BonusAllowed: true, MaxBonusPercent: 10},
        {Title: "Абонемент в спортзал -10%", Description: "На месяц", DiscountType: "percentage", DiscountValue: 10, StartAt: now, EndAt: now.AddDate(0, 2, 0), Status: "published", BonusAllowed: true, MaxBonusPercent: 30},
    }
    for _, o := range offers {
        o.ID = r.idSeq
        r.store[r.idSeq] = o
        r.idSeq++
    }
    return r
}
func (r *OfferRepo) Create(ctx context.Context, o *domain.Offer) error { return nil }
func (r *OfferRepo) GetByID(ctx context.Context, id int64) (*domain.Offer, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    if o, ok := r.store[id]; ok {
        return &o, nil
    }
    return nil, domain.ErrUserNotFound
}
func (r *OfferRepo) List(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]domain.Offer, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    result := []domain.Offer{}
    for _, o := range r.store {
        if o.Status == "published" {
            result = append(result, o)
        }
    }
    return result, nil
}
func (r *OfferRepo) GetActiveOffers(ctx context.Context) ([]domain.Offer, error) {
    return r.List(ctx, nil, 100, 0)
}
func (r *OfferRepo) IncrementUses(ctx context.Context, id int64) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    if o, ok := r.store[id]; ok {
        o.CurrentUses++
        r.store[id] = o
    }
    return nil
}
MEMORY_OFFER

echo "✅ Прототип добавлен!"
echo "Теперь пересоберите и запустите:"
echo "  docker-compose build --no-cache api"
echo "  docker-compose up -d"
