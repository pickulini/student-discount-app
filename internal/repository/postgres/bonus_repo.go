package postgres

import (
    "github.com/jackc/pgx/v5"
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type BonusRepo struct {
    db *DB
}

func NewBonusRepo(db *DB) repository.BonusRepository {
    return &BonusRepo{db: db}
}

func (r *BonusRepo) CreateAccount(ctx context.Context, acc *domain.BonusAccount) error {
    query := `INSERT INTO bonus_accounts (user_id, balance) VALUES ($1, $2) RETURNING id, created_at`
    err := r.db.Pool.QueryRow(ctx, query, acc.UserID, acc.Balance).Scan(&acc.ID, &acc.CreatedAt)
    return err
}

func (r *BonusRepo) GetByUserID(ctx context.Context, userID int64) (*domain.BonusAccount, error) {
    query := `SELECT id, user_id, balance, created_at, updated_at FROM bonus_accounts WHERE user_id = $1`
    var b domain.BonusAccount
    err := r.db.Pool.QueryRow(ctx, query, userID).Scan(&b.ID, &b.UserID, &b.Balance, &b.CreatedAt, &b.UpdatedAt)
    return &b, err
}

func (r *BonusRepo) UpdateBalance(ctx context.Context, id int64, newBalance float64) error {
    query := `UPDATE bonus_accounts SET balance = $1, updated_at = NOW() WHERE id = $2`
    _, err := r.db.Pool.Exec(ctx, query, newBalance, id)
    return err
}

func (r *BonusRepo) CreateTransaction(ctx context.Context, tx *domain.BonusTransaction) error {
    query := `INSERT INTO bonus_transactions (user_id, amount, type, reference_type, reference_id, expires_at) 
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`
    err := r.db.Pool.QueryRow(ctx, query,
        tx.UserID, tx.Amount, tx.Type, tx.ReferenceType, tx.ReferenceID, tx.ExpiresAt,
    ).Scan(&tx.ID, &tx.CreatedAt)
    return err
}

func (r *BonusRepo) GetByUserIDTx(ctx context.Context, tx pgx.Tx, userID int64) (*domain.BonusAccount, error) {
    query := `SELECT id, user_id, balance, created_at, updated_at FROM bonus_accounts WHERE user_id = $1 FOR UPDATE`
    var b domain.BonusAccount
    err := tx.QueryRow(ctx, query, userID).Scan(&b.ID, &b.UserID, &b.Balance, &b.CreatedAt, &b.UpdatedAt)
    return &b, err
}

func (r *BonusRepo) UpdateBalanceTx(ctx context.Context, tx pgx.Tx, id int64, newBalance float64) error {
    query := `UPDATE bonus_accounts SET balance = $1, updated_at = NOW() WHERE id = $2`
    _, err := tx.Exec(ctx, query, newBalance, id)
    return err
}

func (r *BonusRepo) CreateTransactionTx(ctx context.Context, tx pgx.Tx, bt *domain.BonusTransaction) error {
    query := `INSERT INTO bonus_transactions (user_id, amount, type, reference_type, reference_id, expires_at) 
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`
    err := tx.QueryRow(ctx, query,
        bt.UserID, bt.Amount, bt.Type, bt.ReferenceType, bt.ReferenceID, bt.ExpiresAt,
    ).Scan(&bt.ID, &bt.CreatedAt)
    return err
}
