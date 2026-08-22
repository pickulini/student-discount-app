package postgres

import (
    "context"
    "database/sql"
    "time"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type PaymentRepo struct {
    db *DB
}

func NewPaymentRepo(db *DB) repository.PaymentRepository {
    return &PaymentRepo{db: db}
}

func (r *PaymentRepo) Create(ctx context.Context, p *domain.Payment) error {
    query := `INSERT INTO payments (user_id, amount, currency, provider, external_payment_id, status, idempotency_key, payment_url) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at, updated_at`
    err := r.db.Pool.QueryRow(ctx, query,
        p.UserID, p.Amount, p.Currency, p.Provider, p.ExternalPaymentID, p.Status, p.IdempotencyKey, p.PaymentURL,
    ).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
    return err
}

func (r *PaymentRepo) GetByID(ctx context.Context, id int64) (*domain.Payment, error) {
    query := `SELECT id, user_id, amount, currency, provider, external_payment_id, status, idempotency_key, payment_url, created_at, updated_at, completed_at 
              FROM payments WHERE id = $1`
    var p domain.Payment
    var externalID, paymentURL sql.NullString
    var completedAt sql.NullTime
    err := r.db.Pool.QueryRow(ctx, query, id).Scan(
        &p.ID, &p.UserID, &p.Amount, &p.Currency, &p.Provider,
        &externalID, &p.Status, &p.IdempotencyKey, &paymentURL,
        &p.CreatedAt, &p.UpdatedAt, &completedAt,
    )
    if err != nil {
        return nil, err
    }
    if externalID.Valid {
        p.ExternalPaymentID = &externalID.String
    }
    if paymentURL.Valid {
        p.PaymentURL = &paymentURL.String
    }
    if completedAt.Valid {
        p.CompletedAt = &completedAt.Time
    }
    return &p, nil
}

func (r *PaymentRepo) GetByExternalID(ctx context.Context, externalID string) (*domain.Payment, error) {
    query := `SELECT id, user_id, amount, currency, provider, external_payment_id, status, idempotency_key, payment_url, created_at, updated_at, completed_at 
              FROM payments WHERE external_payment_id = $1`
    var p domain.Payment
    var extID, paymentURL sql.NullString
    var completedAt sql.NullTime
    err := r.db.Pool.QueryRow(ctx, query, externalID).Scan(
        &p.ID, &p.UserID, &p.Amount, &p.Currency, &p.Provider,
        &extID, &p.Status, &p.IdempotencyKey, &paymentURL,
        &p.CreatedAt, &p.UpdatedAt, &completedAt,
    )
    if err != nil {
        return nil, err
    }
    if extID.Valid {
        p.ExternalPaymentID = &extID.String
    }
    if paymentURL.Valid {
        p.PaymentURL = &paymentURL.String
    }
    if completedAt.Valid {
        p.CompletedAt = &completedAt.Time
    }
    return &p, nil
}

func (r *PaymentRepo) GetByIdempotencyKey(ctx context.Context, key string) (*domain.Payment, error) {
    query := `SELECT id, user_id, amount, currency, provider, external_payment_id, status, idempotency_key, payment_url, created_at, updated_at, completed_at 
              FROM payments WHERE idempotency_key = $1`
    var p domain.Payment
    var externalID, paymentURL sql.NullString
    var completedAt sql.NullTime
    err := r.db.Pool.QueryRow(ctx, query, key).Scan(
        &p.ID, &p.UserID, &p.Amount, &p.Currency, &p.Provider,
        &externalID, &p.Status, &p.IdempotencyKey, &paymentURL,
        &p.CreatedAt, &p.UpdatedAt, &completedAt,
    )
    if err != nil {
        return nil, err
    }
    if externalID.Valid {
        p.ExternalPaymentID = &externalID.String
    }
    if paymentURL.Valid {
        p.PaymentURL = &paymentURL.String
    }
    if completedAt.Valid {
        p.CompletedAt = &completedAt.Time
    }
    return &p, nil
}

func (r *PaymentRepo) UpdateStatus(ctx context.Context, id int64, status string, externalID *string, completedAt *time.Time) error {
    query := `UPDATE payments SET status=$1, external_payment_id=$2, completed_at=$3, updated_at=NOW() WHERE id=$4`
    _, err := r.db.Pool.Exec(ctx, query, status, externalID, completedAt, id)
    return err
}

func (r *PaymentRepo) UpdatePaymentURL(ctx context.Context, id int64, url string) error {
    query := `UPDATE payments SET payment_url=$1, updated_at=NOW() WHERE id=$2`
    _, err := r.db.Pool.Exec(ctx, query, url, id)
    return err
}
