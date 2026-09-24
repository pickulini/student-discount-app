package postgres

import (
    "github.com/jackc/pgx/v5"
    "context"
    "database/sql"
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
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, redeem_code`
    var companyID interface{}
    if o.CompanyID > 0 {
        companyID = o.CompanyID
    }
    err := r.db.Pool.QueryRow(ctx, query,
        o.UserID, companyID, o.LocationID, o.OfferID,
        o.Subtotal, o.DiscountAmount, o.BonusAmount, o.TotalAmount,
        o.Commission, o.Status, o.CreatedAt,
    ).Scan(&o.ID, &o.RedeemCode)
    if err != nil {
        log.Printf("OrderRepo.Create error: %v", err)
        return err
    }
    log.Printf("OrderRepo.Create success: id=%d", o.ID)
    return nil
}

func (r *OrderRepo) GetByID(ctx context.Context, id int64) (*domain.Order, error) {
    query := `SELECT o.id, o.user_id, o.company_id, o.location_id, o.offer_id, o.subtotal, o.discount_amount, o.bonus_amount, o.total_amount, o.commission, o.status, o.created_at, o.completed_at, o.cancelled_at,
                     o.redeem_code, o.redeemed_at, COALESCE(ofr.title, ''), COALESCE(c.name, ''), ofr.image_url, ofr.address
              FROM orders o
              LEFT JOIN offers ofr ON ofr.id = o.offer_id
              LEFT JOIN companies c ON c.id = o.company_id
              WHERE o.id = $1`
    var o domain.Order
    var companyID sql.NullInt64
    err := r.db.Pool.QueryRow(ctx, query, id).Scan(
        &o.ID, &o.UserID, &companyID, &o.LocationID, &o.OfferID,
        &o.Subtotal, &o.DiscountAmount, &o.BonusAmount, &o.TotalAmount,
        &o.Commission, &o.Status, &o.CreatedAt, &o.CompletedAt, &o.CancelledAt,
        &o.RedeemCode, &o.RedeemedAt, &o.OfferTitle, &o.CompanyName, &o.OfferImage, &o.OfferAddress,
    )
    if companyID.Valid {
        o.CompanyID = companyID.Int64
    }
    return &o, err
}

func (r *OrderRepo) GetByUserID(ctx context.Context, userID int64) ([]domain.Order, error) {
    query := `SELECT o.id, o.user_id, o.company_id, o.location_id, o.offer_id, o.subtotal, o.discount_amount, o.bonus_amount, o.total_amount, o.commission, o.status, o.created_at, o.completed_at, o.cancelled_at,
                     o.redeem_code, o.redeemed_at, COALESCE(ofr.title, ''), COALESCE(c.name, ''), ofr.image_url, ofr.address
              FROM orders o
              LEFT JOIN offers ofr ON ofr.id = o.offer_id
              LEFT JOIN companies c ON c.id = o.company_id
              WHERE o.user_id = $1 ORDER BY o.id`
    rows, err := r.db.Pool.Query(ctx, query, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var orders []domain.Order
    for rows.Next() {
        var o domain.Order
    var companyID sql.NullInt64
        if err := rows.Scan(&o.ID, &o.UserID, &companyID, &o.LocationID, &o.OfferID,
            &o.Subtotal, &o.DiscountAmount, &o.BonusAmount, &o.TotalAmount,
            &o.Commission, &o.Status, &o.CreatedAt, &o.CompletedAt, &o.CancelledAt,
            &o.RedeemCode, &o.RedeemedAt, &o.OfferTitle, &o.CompanyName, &o.OfferImage, &o.OfferAddress); err != nil {
            return nil, err
        }
        if companyID.Valid {
            o.CompanyID = companyID.Int64
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
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, redeem_code`
    var companyID interface{}
    if o.CompanyID > 0 {
        companyID = o.CompanyID
    }
    err := tx.QueryRow(ctx, query,
        o.UserID, companyID, o.LocationID, o.OfferID,
        o.Subtotal, o.DiscountAmount, o.BonusAmount, o.TotalAmount,
        o.Commission, o.Status, o.CreatedAt,
    ).Scan(&o.ID, &o.RedeemCode)
    return err
}

func (r *OrderRepo) UpdateStatusTx(ctx context.Context, tx pgx.Tx, id int64, status string) error {
    query := `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`
    _, err := tx.Exec(ctx, query, status, id)
    return err
}
