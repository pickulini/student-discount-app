package postgres

import (
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
    "github.com/jackc/pgx/v5"
)

type MerchantTransactionRepo struct {
    db *DB
}

func NewMerchantTransactionRepo(db *DB) repository.MerchantTransactionRepository {
    return &MerchantTransactionRepo{db: db}
}

func (r *MerchantTransactionRepo) Create(ctx context.Context, mt *domain.MerchantTransaction) error {
    query := `INSERT INTO merchant_transactions (company_id, order_id, amount, type, status, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`
    err := r.db.Pool.QueryRow(ctx, query, mt.CompanyID, mt.OrderID, mt.Amount, mt.Type, mt.Status, mt.Description).Scan(&mt.ID, &mt.CreatedAt)
    return err
}

func (r *MerchantTransactionRepo) CreateTx(ctx context.Context, tx pgx.Tx, mt *domain.MerchantTransaction) error {
    query := `INSERT INTO merchant_transactions (company_id, order_id, amount, type, status, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`
    err := tx.QueryRow(ctx, query, mt.CompanyID, mt.OrderID, mt.Amount, mt.Type, mt.Status, mt.Description).Scan(&mt.ID, &mt.CreatedAt)
    return err
}

func (r *MerchantTransactionRepo) GetByCompanyID(ctx context.Context, companyID int64) ([]domain.MerchantTransaction, error) {
    query := `SELECT id, company_id, order_id, amount, type, status, description, created_at, completed_at FROM merchant_transactions WHERE company_id = $1 ORDER BY created_at DESC`
    rows, err := r.db.Pool.Query(ctx, query, companyID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var list []domain.MerchantTransaction
    for rows.Next() {
        var mt domain.MerchantTransaction
        if err := rows.Scan(&mt.ID, &mt.CompanyID, &mt.OrderID, &mt.Amount, &mt.Type, &mt.Status, &mt.Description, &mt.CreatedAt, &mt.CompletedAt); err != nil {
            return nil, err
        }
        list = append(list, mt)
    }
    return list, nil
}

func (r *MerchantTransactionRepo) UpdateStatus(ctx context.Context, id int64, status string) error {
    query := `UPDATE merchant_transactions SET status = $1, completed_at = NOW() WHERE id = $2`
    _, err := r.db.Pool.Exec(ctx, query, status, id)
    return err
}
