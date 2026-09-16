package postgres

import (
    "github.com/jackc/pgx/v5"
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
    query := `INSERT INTO offers (company_id, title, description, discount_type, discount_value, start_at, end_at, status, max_uses, current_uses, bonus_allowed, max_bonus_percent) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, created_at, updated_at`
    err := r.db.Pool.QueryRow(ctx, query,
        o.CompanyID, o.Title, o.Description, o.DiscountType, o.DiscountValue,
        o.StartAt, o.EndAt, o.Status, o.MaxUses, o.CurrentUses,
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
    if err != nil {
        return nil, err
    }
    // Загружаем теги
    offers := []domain.Offer{o}
    if err := r.loadTags(ctx, offers); err != nil {
        return nil, err
    }
    return &offers[0], nil
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
	if err := r.loadTags(ctx, offers); err != nil {
		return nil, err
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
	if err := r.loadTags(ctx, offers); err != nil {
		return nil, err
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
	if err := r.loadTags(ctx, offers); err != nil {
		return nil, err
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

func (r *OfferRepo) ExpireOffers(ctx context.Context) error {
    query := `UPDATE offers SET status = 'expired', updated_at = NOW() 
              WHERE status = 'published' AND end_at < NOW()`
    _, err := r.db.Pool.Exec(ctx, query)
    return err
}

func (r *OfferRepo) IncrementUsesTx(ctx context.Context, tx pgx.Tx, id int64) error {
    query := `UPDATE offers SET current_uses = current_uses + 1, updated_at = NOW() WHERE id = $1`
    _, err := tx.Exec(ctx, query, id)
    return err
}


// loadTags загружает теги для списка офферов
func (r *OfferRepo) loadTags(ctx context.Context, offers []domain.Offer) error {
    if len(offers) == 0 {
        return nil
    }
    ids := make([]int64, len(offers))
    for i, o := range offers {
        ids[i] = o.ID
    }
    query := `
        SELECT ot.offer_id, t.id, t.name, t.slug
        FROM offer_tags ot
        JOIN tags t ON t.id = ot.tag_id
        WHERE ot.offer_id = ANY($1)
    `
    rows, err := r.db.Pool.Query(ctx, query, ids)
    if err != nil {
        return err
    }
    defer rows.Close()
    tagMap := make(map[int64][]domain.Tag)
    for rows.Next() {
        var offerID int64
        var t domain.Tag
        if err := rows.Scan(&offerID, &t.ID, &t.Name, &t.Slug); err != nil {
            return err
        }
        tagMap[offerID] = append(tagMap[offerID], t)
    }
    for i := range offers {
        if tags, ok := tagMap[offers[i].ID]; ok {
            offers[i].Tags = tags
        }
    }
    return nil
}
