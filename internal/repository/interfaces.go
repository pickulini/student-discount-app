package repository

import (
    "context"
    "your-project/internal/domain"
)

// ---- Существующие интерфейсы ----

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

type StudentVerificationRepository interface {
    Create(ctx context.Context, v *domain.StudentVerification) error
    GetByUserID(ctx context.Context, userID int64) (*domain.StudentVerification, error)
    List(ctx context.Context, limit, offset int) ([]domain.StudentVerification, error)
    UpdateStatus(ctx context.Context, id int64, status string, verifiedBy int64, rejectionReason string) error
    Update(ctx context.Context, v *domain.StudentVerification) error
}

type SessionRepository interface {
    Create(ctx context.Context, s *domain.UserSession) error
    GetByRefreshTokenHash(ctx context.Context, hash string) (*domain.UserSession, error)
    Revoke(ctx context.Context, id int64) error
    RevokeAll(ctx context.Context, userID int64) error
    UpdateLastUsed(ctx context.Context, id int64) error
}

type UniversityRepository interface {
    GetByDomain(ctx context.Context, domain string) (*domain.University, error)
    GetByID(ctx context.Context, id int64) (*domain.University, error)
}

// ---- Новые интерфейсы для прототипа ----

type CompanyRepository interface {
    Create(ctx context.Context, c *domain.Company) error
    GetByID(ctx context.Context, id int64) (*domain.Company, error)
    List(ctx context.Context, limit, offset int) ([]domain.Company, error)
    Update(ctx context.Context, c *domain.Company) error
    Delete(ctx context.Context, id int64) error
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
    ListAll(ctx context.Context, limit, offset int) ([]domain.Offer, error)
    GetActiveOffers(ctx context.Context) ([]domain.Offer, error)
    GetByCompanyID(ctx context.Context, companyID int64) ([]domain.Offer, error)
    IncrementUses(ctx context.Context, id int64) error
    Update(ctx context.Context, o *domain.Offer) error
    Delete(ctx context.Context, id int64) error
    UpdateStatus(ctx context.Context, id int64, status string) error
}

type OrderRepository interface {
    Create(ctx context.Context, o *domain.Order) error
    GetByID(ctx context.Context, id int64) (*domain.Order, error)
    GetByUserID(ctx context.Context, userID int64) ([]domain.Order, error)
    UpdateStatus(ctx context.Context, id int64, status string) error
}

// ---- Финансовые репозитории ----

type AccountRepository interface {
    Create(ctx context.Context, account *domain.Account) error
    GetByUserIDAndType(ctx context.Context, userID int64, accType string) (*domain.Account, error)
    UpdateBalance(ctx context.Context, id int64, newBalance float64) error
}

type LedgerRepository interface {
    CreateTransaction(ctx context.Context, tx *domain.LedgerTransaction) error
    CreateEntry(ctx context.Context, entry *domain.LedgerEntry) error
    UpdateTransactionStatus(ctx context.Context, id int64, status string) error
    GetTransactionsByUserID(ctx context.Context, userID int64, limit, offset int) ([]domain.TransactionHistory, error)
}

type BonusRepository interface {
    CreateAccount(ctx context.Context, acc *domain.BonusAccount) error
    GetByUserID(ctx context.Context, userID int64) (*domain.BonusAccount, error)
    UpdateBalance(ctx context.Context, id int64, newBalance float64) error
    CreateTransaction(ctx context.Context, tx *domain.BonusTransaction) error
}

// ---- Реферальные репозитории ----

type ReferralRepository interface {
    CreateInvite(ctx context.Context, invite *domain.ReferralInvite) error
    GetInvitesByReferrer(ctx context.Context, referrerID int64) ([]domain.ReferralInvite, error)
    GetInvitesCountByReferrer(ctx context.Context, referrerID int64) (int, error)
    CreateReward(ctx context.Context, reward *domain.ReferralReward) error
    GetRewardsByReferrer(ctx context.Context, referrerID int64) ([]domain.ReferralReward, error)
}

// ---- Поддержка ----

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

// ---- Партнёр ----

type CompanyUserRepository interface {
    Create(ctx context.Context, cu *domain.CompanyUser) error
    GetByUserID(ctx context.Context, userID int64) ([]domain.CompanyUser, error)
    GetByCompanyID(ctx context.Context, companyID int64) ([]domain.CompanyUser, error)
    Delete(ctx context.Context, id int64) error
    UpdateRole(ctx context.Context, id int64, role string) error
}
