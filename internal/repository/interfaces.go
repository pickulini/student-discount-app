package repository


import (
    "context"
    "time"
    "your-project/internal/domain"
    "github.com/jackc/pgx/v5"
)

// ---- User ----
type UserRepository interface {
    Create(ctx context.Context, user *domain.User) error
    GetByEmail(ctx context.Context, email string) (*domain.User, error)
    GetByID(ctx context.Context, id int64) (*domain.User, error)
    GetByReferralCode(ctx context.Context, code string) (*domain.User, error)
    Update(ctx context.Context, user *domain.User) error
    UpdateStudentStatus(ctx context.Context, userID int64, status string) error
    UpdateBalance(ctx context.Context, userID int64, amount float64) error
    UpdateRole(ctx context.Context, userID int64, role string) error
    List(ctx context.Context, limit, offset int) ([]domain.User, error)
}

// ---- StudentVerification ----
type StudentVerificationRepository interface {
    Create(ctx context.Context, v *domain.StudentVerification) error
    GetByUserID(ctx context.Context, userID int64) (*domain.StudentVerification, error)
    GetByID(ctx context.Context, id int64) (*domain.StudentVerification, error)
    List(ctx context.Context, limit, offset int) ([]domain.StudentVerification, error)
    UpdateStatus(ctx context.Context, id int64, status string, verifiedBy int64, rejectionReason string) error
    Update(ctx context.Context, v *domain.StudentVerification) error
}

// ---- Session ----
type SessionRepository interface {
    Create(ctx context.Context, s *domain.UserSession) error
    GetByRefreshTokenHash(ctx context.Context, hash string) (*domain.UserSession, error)
    Revoke(ctx context.Context, id int64) error
    RevokeAll(ctx context.Context, userID int64) error
    UpdateLastUsed(ctx context.Context, id int64) error
}

// ---- University ----
type UniversityRepository interface {
    GetByDomain(ctx context.Context, domain string) (*domain.University, error)
    GetByID(ctx context.Context, id int64) (*domain.University, error)
}

// ---- Company ----
type CompanyRepository interface {
    Create(ctx context.Context, c *domain.Company) error
    GetByID(ctx context.Context, id int64) (*domain.Company, error)
    List(ctx context.Context, limit, offset int) ([]domain.Company, error)
    Update(ctx context.Context, c *domain.Company) error
    Delete(ctx context.Context, id int64) error
}

// ---- Location ----
type LocationRepository interface {
    Create(ctx context.Context, l *domain.CompanyLocation) error
    GetByCompanyID(ctx context.Context, companyID int64) ([]domain.CompanyLocation, error)
    GetNearby(ctx context.Context, lat, lng float64, radius int) ([]domain.CompanyLocation, error)
}

// ---- Offer ----
type OfferRepository interface {
    Create(ctx context.Context, o *domain.Offer) error
    GetByID(ctx context.Context, id int64) (*domain.Offer, error)
    List(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]domain.Offer, error)
    ListAll(ctx context.Context, limit, offset int) ([]domain.Offer, error)
    GetActiveOffers(ctx context.Context) ([]domain.Offer, error)
    GetByCompanyID(ctx context.Context, companyID int64) ([]domain.Offer, error)
    IncrementUses(ctx context.Context, id int64) error
    IncrementUsesTx(ctx context.Context, tx pgx.Tx, id int64) error
    Update(ctx context.Context, o *domain.Offer) error
    Delete(ctx context.Context, id int64) error
    UpdateStatus(ctx context.Context, id int64, status string) error
    ExpireOffers(ctx context.Context) error
}

// ---- Order ----
type OrderRepository interface {
    Create(ctx context.Context, o *domain.Order) error
    CreateTx(ctx context.Context, tx pgx.Tx, o *domain.Order) error
    GetByID(ctx context.Context, id int64) (*domain.Order, error)
    GetByUserID(ctx context.Context, userID int64) ([]domain.Order, error)
    UpdateStatus(ctx context.Context, id int64, status string) error
    UpdateStatusTx(ctx context.Context, tx pgx.Tx, id int64, status string) error
}

// ---- Account ----
type AccountRepository interface {
    Create(ctx context.Context, account *domain.Account) error
    GetByUserIDAndType(ctx context.Context, userID int64, accType string) (*domain.Account, error)
    GetByUserIDAndTypeTx(ctx context.Context, tx pgx.Tx, userID int64, accType string) (*domain.Account, error)
    UpdateBalance(ctx context.Context, id int64, newBalance float64) error
    UpdateBalanceTx(ctx context.Context, tx pgx.Tx, id int64, newBalance float64) error
}

// ---- Ledger ----
type LedgerRepository interface {
    CreateTransaction(ctx context.Context, txObj *domain.LedgerTransaction) error
    CreateTransactionTx(ctx context.Context, tx pgx.Tx, txObj *domain.LedgerTransaction) error
    CreateEntry(ctx context.Context, entry *domain.LedgerEntry) error
    CreateEntryTx(ctx context.Context, tx pgx.Tx, entry *domain.LedgerEntry) error
    UpdateTransactionStatus(ctx context.Context, id int64, status string) error
    UpdateTransactionStatusTx(ctx context.Context, tx pgx.Tx, id int64, status string) error
    GetTransactionsByUserID(ctx context.Context, userID int64, limit, offset int) ([]domain.TransactionHistory, error)
}

// ---- Bonus ----
type BonusRepository interface {
    CreateAccount(ctx context.Context, acc *domain.BonusAccount) error
    GetByUserID(ctx context.Context, userID int64) (*domain.BonusAccount, error)
    GetByUserIDTx(ctx context.Context, tx pgx.Tx, userID int64) (*domain.BonusAccount, error)
    UpdateBalance(ctx context.Context, id int64, newBalance float64) error
    UpdateBalanceTx(ctx context.Context, tx pgx.Tx, id int64, newBalance float64) error
    CreateTransaction(ctx context.Context, bt *domain.BonusTransaction) error
    CreateTransactionTx(ctx context.Context, tx pgx.Tx, bt *domain.BonusTransaction) error
}

// ---- Referral ----
type ReferralRepository interface {
    CreateInvite(ctx context.Context, invite *domain.ReferralInvite) error
    GetInvitesByReferrer(ctx context.Context, referrerID int64) ([]domain.ReferralInvite, error)
    GetInvitesCountByReferrer(ctx context.Context, referrerID int64) (int, error)
    CreateReward(ctx context.Context, reward *domain.ReferralReward) error
    GetRewardsByReferrer(ctx context.Context, referrerID int64) ([]domain.ReferralReward, error)
    UpdateInviteStatus(ctx context.Context, referredUserID int64, status string) error
}

// ---- Support ----
type SupportTicketRepository interface {
    Create(ctx context.Context, ticket *domain.SupportTicket) error
    GetByID(ctx context.Context, id int64) (*domain.SupportTicket, error)
    ListByUserID(ctx context.Context, userID int64) ([]domain.SupportTicket, error)
    ListAll(ctx context.Context, limit, offset int) ([]domain.SupportTicket, error)
    UpdateStatus(ctx context.Context, id int64, status string) error
    UpdateAssignedTo(ctx context.Context, id int64, assignedTo int64) error
}

type SupportMessageRepository interface {
    Create(ctx context.Context, msg *domain.SupportMessage) error
    GetByTicketID(ctx context.Context, ticketID int64) ([]domain.SupportMessage, error)
}

// ---- CompanyUser ----
type CompanyUserRepository interface {
    Create(ctx context.Context, cu *domain.CompanyUser) error
    GetByUserID(ctx context.Context, userID int64) ([]domain.CompanyUser, error)
    GetByCompanyID(ctx context.Context, companyID int64) ([]domain.CompanyUser, error)
    Delete(ctx context.Context, id int64) error
    UpdateRole(ctx context.Context, id int64, role string) error
}

// ---- Payment ----
type PaymentRepository interface {
    Create(ctx context.Context, p *domain.Payment) error
    GetByID(ctx context.Context, id int64) (*domain.Payment, error)
    GetByExternalID(ctx context.Context, externalID string) (*domain.Payment, error)
    GetByIdempotencyKey(ctx context.Context, key string) (*domain.Payment, error)
    UpdateStatus(ctx context.Context, id int64, status string, externalID *string, completedAt *time.Time) error
    UpdatePaymentURL(ctx context.Context, id int64, url string) error
}

// ---- Merchant ----
type MerchantAccountRepository interface {
    Create(ctx context.Context, acc *domain.MerchantAccount) error
    GetByCompanyID(ctx context.Context, companyID int64) (*domain.MerchantAccount, error)
    GetByCompanyIDTx(ctx context.Context, tx pgx.Tx, companyID int64) (*domain.MerchantAccount, error)
    UpdateBalance(ctx context.Context, id int64, newBalance float64) error
    UpdateBalanceTx(ctx context.Context, tx pgx.Tx, id int64, newBalance float64) error
}

type MerchantTransactionRepository interface {
    Create(ctx context.Context, mt *domain.MerchantTransaction) error
    CreateTx(ctx context.Context, tx pgx.Tx, mt *domain.MerchantTransaction) error
    GetByCompanyID(ctx context.Context, companyID int64) ([]domain.MerchantTransaction, error)
    UpdateStatus(ctx context.Context, id int64, status string) error
}

type SettlementRepository interface {
    Create(ctx context.Context, s *domain.Settlement) error
    GetByCompanyID(ctx context.Context, companyID int64) ([]domain.Settlement, error)
    UpdateStatus(ctx context.Context, id int64, status string) error
}

// ---- Audit ----

type AuditRepository interface {
    Create(ctx context.Context, log *domain.AuditLog) error
    List(ctx context.Context, limit, offset int) ([]domain.AuditLog, error)
    ListByActor(ctx context.Context, actorID int64, limit, offset int) ([]domain.AuditLog, error)
    ListByEntity(ctx context.Context, entityType string, entityID int64) ([]domain.AuditLog, error)
}
