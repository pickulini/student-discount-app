package postgres

import (
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type OfferRepo struct {
    db *DB
}

func NewOfferRepo(db *DB) repository.OfferRepository {
    return &OfferRepo{db: db}
}

func (r *OfferRepo) Create(ctx context.Context, o *domain.Offer) error {
    query := `INSERT INTO offers (company_id, title, description, discount_type, discount_value, special_price, start_at, end_at, status, max_uses, current_uses, bonus_allowed, max_bonus_percent) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id, created_at, updated_at`
    err := r.db.Pool.QueryRow(ctx, query,
        o.CompanyID, o.Title, o.Description, o.DiscountType, o.DiscountValue,
        o.SpecialPrice, o.StartAt, o.EndAt, o.Status, o.MaxUses, o.CurrentUses,
        o.BonusAllowed, o.MaxBonusPercent,
    ).Scan(&o.ID, &o.CreatedAt, &o.UpdatedAt)
    return err
}

func (r *OfferRepo) GetByID(ctx context.Context, id int64) (*domain.Offer, error) {
    query := `SELECT id, company_id, title, description, discount_type, discount_value, special_price, start_at, end_at, status, max_uses, current_uses, bonus_allowed, max_bonus_percent, created_at, updated_at 
              FROM offers WHERE id = $1`
    var o domain.Offer
    err := r.db.Pool.QueryRow(ctx, query, id).Scan(
        &o.ID, &o.CompanyID, &o.Title, &o.Description,
        &o.DiscountType, &o.DiscountValue, &o.SpecialPrice,
        &o.StartAt, &o.EndAt, &o.Status, &o.MaxUses, &o.CurrentUses,
        &o.BonusAllowed, &o.MaxBonusPercent, &o.CreatedAt, &o.UpdatedAt,
    )
    return &o, err
}

func (r *OfferRepo) List(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]domain.Offer, error) {
    query := `SELECT id, company_id, title, description, discount_type, discount_value, special_price, start_at, end_at, status, max_uses, current_uses, bonus_allowed, max_bonus_percent, created_at, updated_at 
              FROM offers WHERE status = 'published' ORDER BY id LIMIT $1 OFFSET $2`
    rows, err := r.db.Pool.Query(ctx, query, limit, offset)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var offers []domain.Offer
    for rows.Next() {
        var o domain.Offer
        if err := rows.Scan(&o.ID, &o.CompanyID, &o.Title, &o.Description,
            &o.DiscountType, &o.DiscountValue, &o.SpecialPrice,
            &o.StartAt, &o.EndAt, &o.Status, &o.MaxUses, &o.CurrentUses,
            &o.BonusAllowed, &o.MaxBonusPercent, &o.CreatedAt, &o.UpdatedAt); err != nil {
            return nil, err
        }
        offers = append(offers, o)
    }
    if offers == nil {
        return []domain.Offer{}, nil
    }
    return offers, nil
}

func (r *OfferRepo) ListAll(ctx context.Context, limit, offset int) ([]domain.Offer, error) {
    query := `SELECT id, company_id, title, description, discount_type, discount_value, special_price, start_at, end_at, status, max_uses, current_uses, bonus_allowed, max_bonus_percent, created_at, updated_at 
              FROM offers ORDER BY id LIMIT $1 OFFSET $2`
    rows, err := r.db.Pool.Query(ctx, query, limit, offset)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var offers []domain.Offer
    for rows.Next() {
        var o domain.Offer
        if err := rows.Scan(&o.ID, &o.CompanyID, &o.Title, &o.Description,
            &o.DiscountType, &o.DiscountValue, &o.SpecialPrice,
            &o.StartAt, &o.EndAt, &o.Status, &o.MaxUses, &o.CurrentUses,
            &o.BonusAllowed, &o.MaxBonusPercent, &o.CreatedAt, &o.UpdatedAt); err != nil {
            return nil, err
        }
        offers = append(offers, o)
    }
    if offers == nil {
        return []domain.Offer{}, nil
    }
    return offers, nil
}

func (r *OfferRepo) GetActiveOffers(ctx context.Context) ([]domain.Offer, error) {
    return r.List(ctx, nil, 100, 0)
}

func (r *OfferRepo) GetByCompanyID(ctx context.Context, companyID int64) ([]domain.Offer, error) {
    query := `SELECT id, company_id, title, description, discount_type, discount_value, special_price, start_at, end_at, status, max_uses, current_uses, bonus_allowed, max_bonus_percent, created_at, updated_at 
              FROM offers WHERE company_id = $1`
    rows, err := r.db.Pool.Query(ctx, query, companyID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var offers []domain.Offer
    for rows.Next() {
        var o domain.Offer
        if err := rows.Scan(&o.ID, &o.CompanyID, &o.Title, &o.Description,
            &o.DiscountType, &o.DiscountValue, &o.SpecialPrice,
            &o.StartAt, &o.EndAt, &o.Status, &o.MaxUses, &o.CurrentUses,
            &o.BonusAllowed, &o.MaxBonusPercent, &o.CreatedAt, &o.UpdatedAt); err != nil {
            return nil, err
        }
        offers = append(offers, o)
    }
    return offers, nil
}

func (r *OfferRepo) IncrementUses(ctx context.Context, id int64) error {
    query := `UPDATE offers SET current_uses = current_uses + 1, updated_at = NOW() WHERE id = $1`
    _, err := r.db.Pool.Exec(ctx, query, id)
    return err
}

func (r *OfferRepo) Update(ctx context.Context, o *domain.Offer) error {
    query := `UPDATE offers SET title=$1, description=$2, discount_type=$3, discount_value=$4, special_price=$5, start_at=$6, end_at=$7, status=$8, max_uses=$9, bonus_allowed=$10, max_bonus_percent=$11, updated_at=NOW() WHERE id=$12`
    _, err := r.db.Pool.Exec(ctx, query,
        o.Title, o.Description, o.DiscountType, o.DiscountValue,
        o.SpecialPrice, o.StartAt, o.EndAt, o.Status, o.MaxUses,
        o.BonusAllowed, o.MaxBonusPercent, o.ID,
    )
    return err
}

func (r *OfferRepo) Delete(ctx context.Context, id int64) error {
    query := `DELETE FROM offers WHERE id=$1`
    _, err := r.db.Pool.Exec(ctx, query, id)
    return err
}

func (r *OfferRepo) UpdateStatus(ctx context.Context, id int64, status string) error {
    query := `UPDATE offers SET status=$1, updated_at=NOW() WHERE id=$2`
    _, err := r.db.Pool.Exec(ctx, query, status, id)
    return err
}
