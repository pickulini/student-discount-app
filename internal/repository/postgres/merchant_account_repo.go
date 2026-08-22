package postgres

import (
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
    "github.com/jackc/pgx/v5"
)

type MerchantAccountRepo struct {
    db *DB
}

func NewMerchantAccountRepo(db *DB) repository.MerchantAccountRepository {
    return &MerchantAccountRepo{db: db}
}

func (r *MerchantAccountRepo) Create(ctx context.Context, acc *domain.MerchantAccount) error {
    query := `INSERT INTO merchant_accounts (company_id, balance, currency) VALUES ($1, $2, $3) RETURNING id, created_at, updated_at`
    err := r.db.Pool.QueryRow(ctx, query, acc.CompanyID, acc.Balance, acc.Currency).Scan(&acc.ID, &acc.CreatedAt, &acc.UpdatedAt)
    return err
}

func (r *MerchantAccountRepo) GetByCompanyID(ctx context.Context, companyID int64) (*domain.MerchantAccount, error) {
    query := `SELECT id, company_id, balance, currency, created_at, updated_at FROM merchant_accounts WHERE company_id = $1`
    var a domain.MerchantAccount
    err := r.db.Pool.QueryRow(ctx, query, companyID).Scan(&a.ID, &a.CompanyID, &a.Balance, &a.Currency, &a.CreatedAt, &a.UpdatedAt)
    return &a, err
}

func (r *MerchantAccountRepo) UpdateBalance(ctx context.Context, id int64, newBalance float64) error {
    query := `UPDATE merchant_accounts SET balance = $1, updated_at = NOW() WHERE id = $2`
    _, err := r.db.Pool.Exec(ctx, query, newBalance, id)
    return err
}

func (r *MerchantAccountRepo) UpdateBalanceTx(ctx context.Context, tx pgx.Tx, id int64, newBalance float64) error {
    query := `UPDATE merchant_accounts SET balance = $1, updated_at = NOW() WHERE id = $2`
    _, err := tx.Exec(ctx, query, newBalance, id)
    return err
}

func (r *MerchantAccountRepo) GetByCompanyIDTx(ctx context.Context, tx pgx.Tx, companyID int64) (*domain.MerchantAccount, error) {
    query := `SELECT id, company_id, balance, currency, created_at, updated_at FROM merchant_accounts WHERE company_id = $1 FOR UPDATE`
    var a domain.MerchantAccount
    err := tx.QueryRow(ctx, query, companyID).Scan(&a.ID, &a.CompanyID, &a.Balance, &a.Currency, &a.CreatedAt, &a.UpdatedAt)
    return &a, err
}
