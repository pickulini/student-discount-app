package postgres

import (
    "context"
    "errors"
    "github.com/jackc/pgx/v5"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type AccountRepo struct {
    db *DB
}

func NewAccountRepo(db *DB) repository.AccountRepository {
    return &AccountRepo{db: db}
}

func (r *AccountRepo) Create(ctx context.Context, account *domain.Account) error {
    query := `INSERT INTO accounts (user_id, type, currency, balance, status) 
              VALUES ($1, $2, $3, $4, $5) 
              RETURNING id, created_at, updated_at`
    err := r.db.Pool.QueryRow(ctx, query,
        account.UserID, account.Type, account.Currency, account.Balance, account.Status,
    ).Scan(&account.ID, &account.CreatedAt, &account.UpdatedAt)
    return err
}

func (r *AccountRepo) GetByUserIDAndType(ctx context.Context, userID int64, accType string) (*domain.Account, error) {
    query := `SELECT id, user_id, type, currency, balance, status, created_at, updated_at 
              FROM accounts WHERE user_id = $1 AND type = $2`
    var a domain.Account
    err := r.db.Pool.QueryRow(ctx, query, userID, accType).Scan(
        &a.ID, &a.UserID, &a.Type, &a.Currency, &a.Balance, &a.Status, &a.CreatedAt, &a.UpdatedAt,
    )
    if errors.Is(err, pgx.ErrNoRows) {
        return nil, domain.ErrAccountNotFound
    }
    return &a, err
}

func (r *AccountRepo) UpdateBalance(ctx context.Context, id int64, newBalance float64) error {
    query := `UPDATE accounts SET balance = $1, updated_at = NOW() WHERE id = $2`
    _, err := r.db.Pool.Exec(ctx, query, newBalance, id)
    return err
}
