package postgres

import (
    "context"
    "database/sql"
    "log"
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
    query := `INSERT INTO offers (company_id, title, description, terms, discount_type, discount_value, special_price, start_at, end_at, status, max_uses, current_uses, bonus_allowed, max_bonus_percent) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id, created_at, updated_at`
    err := r.db.Pool.QueryRow(ctx, query,
        o.CompanyID, o.Title, o.Description, o.Terms, o.DiscountType, o.DiscountValue,
        o.SpecialPrice, o.StartAt, o.EndAt, o.Status, o.MaxUses, o.CurrentUses,
        o.BonusAllowed, o.MaxBonusPercent,
    ).Scan(&o.ID, &o.CreatedAt, &o.UpdatedAt)
    return err
}

func (r *OfferRepo) GetByID(ctx context.Context, id int64) (*domain.Offer, error) {
    query := `SELECT id, company_id, title, description, terms, discount_type, discount_value, special_price, start_at, end_at, status, max_uses, current_uses, bonus_allowed, max_bonus_percent, created_at, updated_at 
              FROM offers WHERE id = $1`
    var o domain.Offer
    var terms sql.NullString
    var specialPrice sql.NullFloat64
    var maxUses sql.NullInt64
    err := r.db.Pool.QueryRow(ctx, query, id).Scan(
        &o.ID, &o.CompanyID, &o.Title, &o.Description, &terms,
        &o.DiscountType, &o.DiscountValue, &specialPrice,
        &o.StartAt, &o.EndAt, &o.Status, &maxUses, &o.CurrentUses,
        &o.BonusAllowed, &o.MaxBonusPercent, &o.CreatedAt, &o.UpdatedAt,
    )
    if err != nil {
        return nil, err
    }
    if terms.Valid {
        o.Terms = &terms.String
    }
    if specialPrice.Valid {
        o.SpecialPrice = &specialPrice.Float64
    }
    if maxUses.Valid {
        val := int(maxUses.Int64)
        o.MaxUses = &val
    }
    return &o, nil
}

func (r *OfferRepo) List(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]domain.Offer, error) {
    query := `SELECT id, company_id, title, description, terms, discount_type, discount_value, special_price, start_at, end_at, status, max_uses, current_uses, bonus_allowed, max_bonus_percent, created_at, updated_at 
              FROM offers WHERE status = 'published' ORDER BY id LIMIT $1 OFFSET $2`
    rows, err := r.db.Pool.Query(ctx, query, limit, offset)
    if err != nil {
        log.Printf("OfferRepo.List query error: %v", err)
        return nil, err
    }
    defer rows.Close()
    var offers []domain.Offer
    for rows.Next() {
        var o domain.Offer
        var terms sql.NullString
        var specialPrice sql.NullFloat64
        var maxUses sql.NullInt64
        if err := rows.Scan(&o.ID, &o.CompanyID, &o.Title, &o.Description, &terms,
            &o.DiscountType, &o.DiscountValue, &specialPrice,
            &o.StartAt, &o.EndAt, &o.Status, &maxUses, &o.CurrentUses,
            &o.BonusAllowed, &o.MaxBonusPercent, &o.CreatedAt, &o.UpdatedAt); err != nil {
            log.Printf("OfferRepo.List scan error: %v", err)
            return nil, err
        }
        if terms.Valid {
            o.Terms = &terms.String
        }
        if specialPrice.Valid {
            o.SpecialPrice = &specialPrice.Float64
        }
        if maxUses.Valid {
            val := int(maxUses.Int64)
            o.MaxUses = &val
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

func (r *OfferRepo) IncrementUses(ctx context.Context, id int64) error {
    query := `UPDATE offers SET current_uses = current_uses + 1, updated_at = NOW() WHERE id = $1`
    _, err := r.db.Pool.Exec(ctx, query, id)
    return err
}

func (r *OfferRepo) Update(ctx context.Context, o *domain.Offer) error {
    query := `UPDATE offers SET title=$1, description=$2, terms=$3, discount_type=$4, discount_value=$5, special_price=$6, start_at=$7, end_at=$8, status=$9, max_uses=$10, bonus_allowed=$11, max_bonus_percent=$12, updated_at=NOW() WHERE id=$13`
    _, err := r.db.Pool.Exec(ctx, query,
        o.Title, o.Description, o.Terms, o.DiscountType, o.DiscountValue,
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
