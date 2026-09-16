package postgres

import (
    "github.com/jackc/pgx/v5"
    "context"
    "log"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type OrderRepo struct {
    db *DB
}

func NewOrderRepo(db *DB) repository.OrderRepository {
    return &OrderRepo{db: db}
}

func (r *OrderRepo) Create(ctx context.Context, o *domain.Order) error {
    query := `INSERT INTO orders (user_id, company_id, location_id, offer_id, subtotal, discount_amount, bonus_amount, total_amount, commission, status, created_at) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`
    err := r.db.Pool.QueryRow(ctx, query,
        o.UserID, o.CompanyID, o.LocationID, o.OfferID,
        o.Subtotal, o.DiscountAmount, o.BonusAmount, o.TotalAmount,
        o.Commission, o.Status, o.CreatedAt,
    ).Scan(&o.ID)
    if err != nil {
        log.Printf("OrderRepo.Create error: %v", err)
        return err
    }
    log.Printf("OrderRepo.Create success: id=%d", o.ID)
    return nil
}

func (r *OrderRepo) GetByID(ctx context.Context, id int64) (*domain.Order, error) {
    query := `SELECT id, user_id, company_id, location_id, offer_id, subtotal, discount_amount, bonus_amount, total_amount, commission, status, created_at, completed_at, cancelled_at 
              FROM orders WHERE id = $1`
    var o domain.Order
    err := r.db.Pool.QueryRow(ctx, query, id).Scan(
        &o.ID, &o.UserID, &o.CompanyID, &o.LocationID, &o.OfferID,
        &o.Subtotal, &o.DiscountAmount, &o.BonusAmount, &o.TotalAmount,
        &o.Commission, &o.Status, &o.CreatedAt, &o.CompletedAt, &o.CancelledAt,
    )
    return &o, err
}

func (r *OrderRepo) GetByUserID(ctx context.Context, userID int64) ([]domain.Order, error) {
    query := `SELECT id, user_id, company_id, location_id, offer_id, subtotal, discount_amount, bonus_amount, total_amount, commission, status, created_at, completed_at, cancelled_at 
              FROM orders WHERE user_id = $1 ORDER BY id`
    rows, err := r.db.Pool.Query(ctx, query, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var orders []domain.Order
    for rows.Next() {
        var o domain.Order
        if err := rows.Scan(&o.ID, &o.UserID, &o.CompanyID, &o.LocationID, &o.OfferID,
            &o.Subtotal, &o.DiscountAmount, &o.BonusAmount, &o.TotalAmount,
            &o.Commission, &o.Status, &o.CreatedAt, &o.CompletedAt, &o.CancelledAt); err != nil {
            return nil, err
        }
        orders = append(orders, o)
    }
    return orders, nil
}

func (r *OrderRepo) UpdateStatus(ctx context.Context, id int64, status string) error {
    query := `UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2`
    _, err := r.db.Pool.Exec(ctx, query, status, id)
    return err
}

func (r *OrderRepo) CreateTx(ctx context.Context, tx pgx.Tx, o *domain.Order) error {
    query := `INSERT INTO orders (user_id, company_id, location_id, offer_id, subtotal, discount_amount, bonus_amount, total_amount, commission, status, created_at) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`
    err := tx.QueryRow(ctx, query,
        o.UserID, o.CompanyID, o.LocationID, o.OfferID,
        o.Subtotal, o.DiscountAmount, o.BonusAmount, o.TotalAmount,
        o.Commission, o.Status, o.CreatedAt,
    ).Scan(&o.ID)
    return err
}

func (r *OrderRepo) UpdateStatusTx(ctx context.Context, tx pgx.Tx, id int64, status string) error {
    query := `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`
    _, err := tx.Exec(ctx, query, status, id)
    return err
}
