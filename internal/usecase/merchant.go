package usecase

import (
    "context"
    "time"
    "your-project/internal/domain"
    "your-project/internal/repository"
    "github.com/jackc/pgx/v5/pgxpool"
)

type MerchantUsecase struct {
    companyRepo      repository.CompanyRepository
    locationRepo     repository.LocationRepository
    offerRepo        repository.OfferRepository
    companyUserRepo  repository.CompanyUserRepository
    userRepo         repository.UserRepository
    db               *pgxpool.Pool
}

func NewMerchantUsecase(
    companyRepo repository.CompanyRepository,
    locationRepo repository.LocationRepository,
    offerRepo repository.OfferRepository,
    companyUserRepo repository.CompanyUserRepository,
    userRepo repository.UserRepository,
    db *pgxpool.Pool,
) *MerchantUsecase {
    return &MerchantUsecase{
        companyRepo:     companyRepo,
        locationRepo:    locationRepo,
        offerRepo:       offerRepo,
        companyUserRepo: companyUserRepo,
        userRepo:        userRepo,
        db:              db,
    }
}

// GetUserCompanies – список компаний, к которым привязан пользователь
func (u *MerchantUsecase) GetUserCompanies(ctx context.Context, userID int64) ([]domain.Company, error) {
    companyUsers, err := u.companyUserRepo.GetByUserID(ctx, userID)
    if err != nil {
        return nil, err
    }
    if len(companyUsers) == 0 {
        return []domain.Company{}, nil
    }
    var companies []domain.Company
    for _, cu := range companyUsers {
        c, err := u.companyRepo.GetByID(ctx, cu.CompanyID)
        if err != nil {
            return nil, err
        }
        companies = append(companies, *c)
    }
    return companies, nil
}

// GetUserOffers – все предложения, созданные пользователем (через его компании)
func (u *MerchantUsecase) GetUserOffers(ctx context.Context, userID int64) ([]domain.Offer, error) {
    companies, err := u.GetUserCompanies(ctx, userID)
    if err != nil {
        return nil, err
    }
    if len(companies) == 0 {
        return []domain.Offer{}, nil
    }
    var offers []domain.Offer
    for _, c := range companies {
        opts, err := u.offerRepo.GetByCompanyID(ctx, c.ID)
        if err != nil {
            return nil, err
        }
        offers = append(offers, opts...)
    }
    return offers, nil
}

// CreateOffer – создание предложения
func (u *MerchantUsecase) CreateOffer(ctx context.Context, userID int64, offer *domain.Offer) error {
    companyUsers, err := u.companyUserRepo.GetByUserID(ctx, userID)
    if err != nil {
        return err
    }
    found := false
    for _, cu := range companyUsers {
        if cu.CompanyID == offer.CompanyID {
            found = true
            break
        }
    }
    if !found {
        return domain.ErrUnauthorized
    }
    offer.Status = "draft"
    return u.offerRepo.Create(ctx, offer)
}

// SubmitForReview – отправка на модерацию
func (u *MerchantUsecase) SubmitForReview(ctx context.Context, userID, offerID int64) error {
    offer, err := u.offerRepo.GetByID(ctx, offerID)
    if err != nil {
        return err
    }
    companyUsers, err := u.companyUserRepo.GetByUserID(ctx, userID)
    if err != nil {
        return err
    }
    found := false
    for _, cu := range companyUsers {
        if cu.CompanyID == offer.CompanyID {
            found = true
            break
        }
    }
    if !found {
        return domain.ErrUnauthorized
    }
    if offer.Status != "draft" {
        return domain.ErrInvalidStatus
    }
    return u.offerRepo.UpdateStatus(ctx, offerID, "pending_review")
}

// GetCompanyStats – статистика по конкретной компании
func (u *MerchantUsecase) GetCompanyStats(ctx context.Context, companyID int64) (map[string]interface{}, error) {
    var totalOrders int
    var totalRevenue float64
    // Запрос к orders по company_id
    err := u.db.QueryRow(ctx, `
        SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(total_amount), 0)
        FROM orders
        WHERE company_id = $1
    `, companyID).Scan(&totalOrders, &totalRevenue)
    if err != nil {
        return nil, err
    }
    return map[string]interface{}{
        "total_orders": totalOrders,
        "total_revenue": totalRevenue,
    }, nil
}

// GetDailyStats – агрегированная статистика по всем компаниям пользователя
func (u *MerchantUsecase) GetDailyStats(ctx context.Context, userID int64, days int) (interface{}, error) {
    companies, err := u.GetUserCompanies(ctx, userID)
    if err != nil {
        return nil, err
    }
    if len(companies) == 0 {
        return map[string]interface{}{
            "daily": []map[string]interface{}{},
            "total_orders": 0,
            "total_revenue": 0,
        }, nil
    }
    totalOrders := 0
    totalRevenue := 0.0
    // Для демонстрации соберём статистику по всем компаниям
    for _, c := range companies {
        stats, err := u.GetCompanyStats(ctx, c.ID)
        if err != nil {
            return nil, err
        }
        totalOrders += stats["total_orders"].(int)
        totalRevenue += stats["total_revenue"].(float64)
    }
    // Можно также сделать группировку по дням, но для MVP пока просто суммарная статистика
    // Чтобы показать график, нужны данные по дням – пока оставим заглушку
    daily := []map[string]interface{}{
        {"date": time.Now().AddDate(0, 0, -1).Format("2006-01-02"), "orders": 0, "revenue": 0},
        {"date": time.Now().Format("2006-01-02"), "orders": totalOrders, "revenue": totalRevenue},
    }
    return map[string]interface{}{
        "daily": daily,
        "total_orders": totalOrders,
        "total_revenue": totalRevenue,
    }, nil
}
