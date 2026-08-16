package usecase

import (
    "context"
    "time"
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
    accountRepo    repository.AccountRepository
    bonusRepo      repository.BonusRepository
    db             *pgxpool.Pool
}

func NewAdminUsecase(
    userRepo repository.UserRepository,
    companyRepo repository.CompanyRepository,
    locationRepo repository.LocationRepository,
    offerRepo repository.OfferRepository,
    verificationRepo repository.StudentVerificationRepository,
    accountRepo repository.AccountRepository,
    bonusRepo repository.BonusRepository,
    db *pgxpool.Pool,
) *AdminUsecase {
    return &AdminUsecase{
        userRepo:       userRepo,
        companyRepo:    companyRepo,
        locationRepo:   locationRepo,
        offerRepo:      offerRepo,
        verificationRepo: verificationRepo,
        accountRepo:    accountRepo,
        bonusRepo:      bonusRepo,
        db:             db,
    }
}

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

func (u *AdminUsecase) ListOffers(ctx context.Context, limit, offset int) ([]domain.Offer, error) {
    return u.offerRepo.ListAll(ctx, limit, offset)
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
func (u *AdminUsecase) ModerateOffer(ctx context.Context, id int64, action string) error {
    if action == "publish" {
        return u.offerRepo.UpdateStatus(ctx, id, "published")
    } else if action == "reject" {
        return u.offerRepo.UpdateStatus(ctx, id, "rejected")
    }
    return nil
}

func (u *AdminUsecase) ListVerifications(ctx context.Context, limit, offset int) ([]domain.StudentVerification, error) {
    return u.verificationRepo.List(ctx, limit, offset)
}
func (u *AdminUsecase) UpdateVerification(ctx context.Context, id int64, status string, rejectionReason string) error {
    return u.verificationRepo.UpdateStatus(ctx, id, status, 0, rejectionReason)
}

func (u *AdminUsecase) GetStatistics(ctx context.Context) (map[string]interface{}, error) {
    var totalUsers, totalCompanies, totalOffers, totalOrders int
    var totalRevenue float64
    u.db.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&totalUsers)
    u.db.QueryRow(ctx, `SELECT COUNT(*) FROM companies`).Scan(&totalCompanies)
    u.db.QueryRow(ctx, `SELECT COUNT(*) FROM offers`).Scan(&totalOffers)
    u.db.QueryRow(ctx, `SELECT COUNT(*) FROM orders`).Scan(&totalOrders)
    u.db.QueryRow(ctx, `SELECT COALESCE(SUM(total_amount), 0) FROM orders`).Scan(&totalRevenue)
    return map[string]interface{}{
        "total_users":     totalUsers,
        "total_companies": totalCompanies,
        "total_offers":    totalOffers,
        "total_orders":    totalOrders,
        "total_revenue":   totalRevenue,
    }, nil
}

func (u *AdminUsecase) GetUserDetailedStats(ctx context.Context, userID int64) (map[string]interface{}, error) {
    user, err := u.userRepo.GetByID(ctx, userID)
    if err != nil {
        return nil, err
    }
    account, err := u.accountRepo.GetByUserIDAndType(ctx, userID, "cash")
    if err != nil {
        return nil, err
    }
    bonusAcc, err := u.bonusRepo.GetByUserID(ctx, userID)
    if err != nil {
        return nil, err
    }

    var totalDeposits, totalPurchases, totalBonusEarned, totalBonusSpent float64
    var totalOrders int

    u.db.QueryRow(ctx, `
        SELECT COALESCE(SUM(le.amount), 0) 
        FROM ledger_transactions lt 
        JOIN ledger_entries le ON lt.id = le.transaction_id 
        JOIN accounts a ON le.account_id = a.id 
        WHERE a.user_id = $1 AND lt.type = 'deposit' AND le.amount > 0
    `, userID).Scan(&totalDeposits)

    u.db.QueryRow(ctx, `
        SELECT COALESCE(SUM(ABS(le.amount)), 0) 
        FROM ledger_transactions lt 
        JOIN ledger_entries le ON lt.id = le.transaction_id 
        JOIN accounts a ON le.account_id = a.id 
        WHERE a.user_id = $1 AND lt.type = 'purchase' AND le.amount < 0
    `, userID).Scan(&totalPurchases)

    u.db.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE user_id = $1`, userID).Scan(&totalOrders)

    u.db.QueryRow(ctx, `
        SELECT COALESCE(SUM(amount), 0) FROM bonus_transactions WHERE user_id = $1 AND amount > 0
    `, userID).Scan(&totalBonusEarned)

    u.db.QueryRow(ctx, `
        SELECT COALESCE(SUM(ABS(amount)), 0) FROM bonus_transactions WHERE user_id = $1 AND amount < 0
    `, userID).Scan(&totalBonusSpent)

    rows, err := u.db.Query(ctx, `
        SELECT id, type, amount, description, status, created_at FROM (
            SELECT 
                lt.id,
                lt.type,
                le.amount,
                lt.description,
                lt.status,
                lt.created_at
            FROM ledger_transactions lt
            JOIN ledger_entries le ON lt.id = le.transaction_id
            JOIN accounts a ON le.account_id = a.id
            WHERE a.user_id = $1
            UNION ALL
            SELECT 
                bt.id,
                bt.type,
                bt.amount,
                'Бонусная операция' as description,
                'completed' as status,
                bt.created_at
            FROM bonus_transactions bt
            WHERE bt.user_id = $1
        ) t
        ORDER BY created_at DESC
        LIMIT 20
    `, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var transactions []map[string]interface{}
    for rows.Next() {
        var id int64
        var typ, description, status string
        var amount float64
        var createdAt time.Time
        if err := rows.Scan(&id, &typ, &amount, &description, &status, &createdAt); err != nil {
            return nil, err
        }
        transactions = append(transactions, map[string]interface{}{
            "id":          id,
            "type":        typ,
            "amount":      amount,
            "description": description,
            "status":      status,
            "created_at":  createdAt,
        })
    }

    return map[string]interface{}{
        "user":            user,
        "balance":         account.Balance,
        "bonus_balance":   bonusAcc.Balance,
        "total_deposits":  totalDeposits,
        "total_purchases": totalPurchases,
        "total_orders":    totalOrders,
        "bonus_earned":    totalBonusEarned,
        "bonus_spent":     totalBonusSpent,
        "transactions":    transactions,
    }, nil
}
