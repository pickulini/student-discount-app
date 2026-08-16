package usecase

import (
    "context"
    "log"
    "your-project/internal/domain"
    "your-project/internal/repository"
    "github.com/jackc/pgx/v5/pgxpool"
)

type AdminUsecase struct {
    userRepo       repository.UserRepository
    companyRepo    repository.CompanyRepository
    locationRepo   repository.LocationRepository
    offerRepo      repository.OfferRepository
    verificationRepo repository.StudentVerificationRepository
    db             *pgxpool.Pool
}

func NewAdminUsecase(
    userRepo repository.UserRepository,
    companyRepo repository.CompanyRepository,
    locationRepo repository.LocationRepository,
    offerRepo repository.OfferRepository,
    verificationRepo repository.StudentVerificationRepository,
    db *pgxpool.Pool,
) *AdminUsecase {
    return &AdminUsecase{
        userRepo:       userRepo,
        companyRepo:    companyRepo,
        locationRepo:   locationRepo,
        offerRepo:      offerRepo,
        verificationRepo: verificationRepo,
        db:             db,
    }
}

// ---- Пользователи ----
func (u *AdminUsecase) ListUsers(ctx context.Context, limit, offset int) ([]domain.User, error) {
    query := `SELECT u.id, u.email, u.full_name, u.student_status, u.referral_code, u.is_active, u.created_at, u.updated_at,
                     COALESCE(a.balance, 0) as account_balance
              FROM users u
              LEFT JOIN accounts a ON u.id = a.user_id AND a.type = 'cash'
              ORDER BY u.id LIMIT $1 OFFSET $2`
    rows, err := u.db.Query(ctx, query, limit, offset)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var users []domain.User
    for rows.Next() {
        var u domain.User
        var accountBalance float64
        if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.StudentStatus,
            &u.ReferralCode, &u.IsActive, &u.CreatedAt, &u.UpdatedAt, &accountBalance); err != nil {
            return nil, err
        }
        u.Balance = accountBalance
        users = append(users, u)
    }
    return users, nil
}

func (u *AdminUsecase) GetUser(ctx context.Context, id int64) (*domain.User, error) {
    return u.userRepo.GetByID(ctx, id)
}

func (u *AdminUsecase) UpdateUserRole(ctx context.Context, userID int64, role string) error {
    return nil
}

// ---- Компании ----
func (u *AdminUsecase) ListCompanies(ctx context.Context, limit, offset int) ([]domain.Company, error) {
    return u.companyRepo.List(ctx, limit, offset)
}

func (u *AdminUsecase) CreateCompany(ctx context.Context, company *domain.Company) error {
    return u.companyRepo.Create(ctx, company)
}

func (u *AdminUsecase) UpdateCompany(ctx context.Context, company *domain.Company) error {
    return u.companyRepo.Update(ctx, company)
}

func (u *AdminUsecase) DeleteCompany(ctx context.Context, id int64) error {
    return u.companyRepo.Delete(ctx, id)
}

// ---- Предложения ----
func (u *AdminUsecase) ListOffers(ctx context.Context, limit, offset int) ([]domain.Offer, error) {
    return u.offerRepo.List(ctx, nil, limit, offset)
}

func (u *AdminUsecase) CreateOffer(ctx context.Context, offer *domain.Offer) error {
    return u.offerRepo.Create(ctx, offer)
}

func (u *AdminUsecase) UpdateOffer(ctx context.Context, offer *domain.Offer) error {
    return u.offerRepo.Update(ctx, offer)
}

func (u *AdminUsecase) DeleteOffer(ctx context.Context, id int64) error {
    return u.offerRepo.Delete(ctx, id)
}

// ---- Верификации ----
func (u *AdminUsecase) ListVerifications(ctx context.Context, limit, offset int) ([]domain.StudentVerification, error) {
    return u.verificationRepo.List(ctx, limit, offset)
}

func (u *AdminUsecase) UpdateVerification(ctx context.Context, id int64, status string, adminID int64) error {
    return u.verificationRepo.UpdateStatus(ctx, id, status, adminID, "")
}

// ---- Статистика ----
func (u *AdminUsecase) GetStatistics(ctx context.Context) (map[string]interface{}, error) {
    var totalUsers, totalCompanies, totalOffers, totalOrders int
    var totalRevenue float64

    err := u.db.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&totalUsers)
    if err != nil {
        log.Printf("failed to count users: %v", err)
    }
    err = u.db.QueryRow(ctx, `SELECT COUNT(*) FROM companies`).Scan(&totalCompanies)
    if err != nil {
        log.Printf("failed to count companies: %v", err)
    }
    err = u.db.QueryRow(ctx, `SELECT COUNT(*) FROM offers`).Scan(&totalOffers)
    if err != nil {
        log.Printf("failed to count offers: %v", err)
    }
    err = u.db.QueryRow(ctx, `SELECT COUNT(*) FROM orders`).Scan(&totalOrders)
    if err != nil {
        log.Printf("failed to count orders: %v", err)
    }
    err = u.db.QueryRow(ctx, `SELECT COALESCE(SUM(total_amount), 0) FROM orders`).Scan(&totalRevenue)
    if err != nil {
        log.Printf("failed to sum revenue: %v", err)
    }

    return map[string]interface{}{
        "total_users":     totalUsers,
        "total_companies": totalCompanies,
        "total_offers":    totalOffers,
        "total_orders":    totalOrders,
        "total_revenue":   totalRevenue,
    }, nil
}
