package postgres

import (
    "context"
    "database/sql"
    "strconv"
    "strings"
    "github.com/jackc/pgx/v5"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type OfferRepo struct {
    db *DB
}

func NewOfferRepo(db *DB) repository.OfferRepository {
    return &OfferRepo{db: db}
}

// scanOffer сканирует одну строку в domain.Offer с учётом nullable-полей
func scanOffer(scan func(dest ...interface{}) error) (domain.Offer, error) {
    var o domain.Offer
    var imageURL, address, phone, website, workingHours sql.NullString
    err := scan(
        &o.ID, &o.CompanyID, &o.Title, &o.Description,
        &o.DiscountType, &o.DiscountValue, &o.SpecialPrice,
        &o.StartAt, &o.EndAt, &o.Status, &o.MaxUses, &o.CurrentUses,
        &o.BonusAllowed, &o.MaxBonusPercent, &o.CreatedAt, &o.UpdatedAt,
        &imageURL, &address, &phone, &website, &workingHours,
    )
    if err != nil {
        return o, err
    }
    if imageURL.Valid {
        o.ImageURL = &imageURL.String
    }
    if address.Valid {
        o.Address = &address.String
    }
    if phone.Valid {
        o.Phone = &phone.String
    }
    if website.Valid {
        o.Website = &website.String
    }
    if workingHours.Valid {
        o.WorkingHours = &workingHours.String
    }
    return o, nil
}

const offerColumns = `id, company_id, title, description, discount_type, discount_value, special_price, start_at, end_at, status, max_uses, current_uses, bonus_allowed, max_bonus_percent, created_at, updated_at, image_url, address, phone, website, working_hours`

func (r *OfferRepo) Create(ctx context.Context, o *domain.Offer) error {
    query := `INSERT INTO offers (company_id, title, description, discount_type, discount_value, start_at, end_at, status, max_uses, current_uses, bonus_allowed, max_bonus_percent, image_url, address, phone, website, working_hours) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id, created_at, updated_at`
    err := r.db.Pool.QueryRow(ctx, query,
        o.CompanyID, o.Title, o.Description, o.DiscountType, o.DiscountValue,
        o.StartAt, o.EndAt, o.Status, o.MaxUses, o.CurrentUses,
        o.BonusAllowed, o.MaxBonusPercent,
        o.ImageURL, o.Address, o.Phone, o.Website, o.WorkingHours,
    ).Scan(&o.ID, &o.CreatedAt, &o.UpdatedAt)
    return err
}

func (r *OfferRepo) GetByID(ctx context.Context, id int64) (*domain.Offer, error) {
    query := `SELECT ` + offerColumns + ` FROM offers WHERE id = $1`
    row := r.db.Pool.QueryRow(ctx, query, id)
    o, err := scanOffer(row.Scan)
    if err != nil {
        return nil, err
    }
    offers := []domain.Offer{o}
    if err := r.loadTags(ctx, offers); err != nil {
        return nil, err
    }
    return &offers[0], nil
}

func (r *OfferRepo) List(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]domain.Offer, error) {
    baseQuery := `SELECT DISTINCT o.id, o.company_id, o.title, o.description, o.discount_type, o.discount_value, o.special_price, o.start_at, o.end_at, o.status, o.max_uses, o.current_uses, o.bonus_allowed, o.max_bonus_percent, o.created_at, o.updated_at, o.image_url, o.address, o.phone, o.website, o.working_hours
              FROM offers o`

    where := []string{"o.status = 'published'"}
    args := []interface{}{}
    argIdx := 1

    if filters != nil {
        if tagsRaw, ok := filters["tags"].(string); ok && tagsRaw != "" {
            slugs := strings.Split(tagsRaw, ",")
            cleaned := make([]string, 0, len(slugs))
            for _, s := range slugs {
                s = strings.TrimSpace(s)
                if s != "" {
                    cleaned = append(cleaned, s)
                }
            }
            if len(cleaned) > 0 {
                baseQuery += `
              JOIN offer_tags ot ON ot.offer_id = o.id
              JOIN tags t ON t.id = ot.tag_id`
                where = append(where, "t.slug = ANY($"+strconv.Itoa(argIdx)+")")
                args = append(args, cleaned)
                argIdx++
            }
        }
    }

    query := baseQuery + " WHERE " + strings.Join(where, " AND ") + " ORDER BY o.id"
    query += " LIMIT $" + strconv.Itoa(argIdx) + " OFFSET $" + strconv.Itoa(argIdx+1)
    args = append(args, limit, offset)

    rows, err := r.db.Pool.Query(ctx, query, args...)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var offers []domain.Offer
    for rows.Next() {
        o, err := scanOffer(rows.Scan)
        if err != nil {
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
    query := `SELECT ` + offerColumns + ` FROM offers ORDER BY id LIMIT $1 OFFSET $2`
    rows, err := r.db.Pool.Query(ctx, query, limit, offset)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var offers []domain.Offer
    for rows.Next() {
        o, err := scanOffer(rows.Scan)
        if err != nil {
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
    query := `SELECT ` + offerColumns + ` FROM offers WHERE company_id = $1`
    rows, err := r.db.Pool.Query(ctx, query, companyID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var offers []domain.Offer
    for rows.Next() {
        o, err := scanOffer(rows.Scan)
        if err != nil {
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

func (r *OfferRepo) IncrementUses(ctx context.Context, id int64) error {
    query := `UPDATE offers SET current_uses = current_uses + 1, updated_at = NOW() WHERE id = $1`
    _, err := r.db.Pool.Exec(ctx, query, id)
    return err
}

func (r *OfferRepo) IncrementUsesTx(ctx context.Context, tx pgx.Tx, id int64) error {
    query := `UPDATE offers SET current_uses = current_uses + 1, updated_at = NOW() WHERE id = $1`
    _, err := tx.Exec(ctx, query, id)
    return err
}

func (r *OfferRepo) Update(ctx context.Context, o *domain.Offer) error {
    query := `UPDATE offers SET title=$1, description=$2, discount_type=$3, discount_value=$4, special_price=$5, start_at=$6, end_at=$7, status=$8, max_uses=$9, bonus_allowed=$10, max_bonus_percent=$11, image_url=$12, address=$13, phone=$14, website=$15, working_hours=$16, updated_at=NOW() WHERE id=$17`
    _, err := r.db.Pool.Exec(ctx, query,
        o.Title, o.Description, o.DiscountType, o.DiscountValue,
        o.SpecialPrice, o.StartAt, o.EndAt, o.Status, o.MaxUses,
        o.BonusAllowed, o.MaxBonusPercent,
        o.ImageURL, o.Address, o.Phone, o.Website, o.WorkingHours,
        o.ID,
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
        SELECT ot.offer_id, t.id, t.name, t.slug, t.created_at
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
        if err := rows.Scan(&offerID, &t.ID, &t.Name, &t.Slug, &t.CreatedAt); err != nil {
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
