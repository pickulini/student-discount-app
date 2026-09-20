package postgres

import (
    "context"
    "database/sql"
    "encoding/json"
    "log"
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
    var imageURL, address, phone, website, workingHours, rejectionReason sql.NullString
    var companyID, organizerID, eventUniversityID sql.NullInt64
    var adminEditedData []byte
    var adminEditComment, partnerRejectComment sql.NullString
    var latitude, longitude sql.NullFloat64
    var placeName sql.NullString
    var recurrenceRule sql.NullString
    var recurrenceUntil sql.NullTime

    err := scan(
        &o.ID, &companyID, &o.Title, &o.Description,
        &o.DiscountType, &o.DiscountValue, &o.SpecialPrice,
        &o.StartAt, &o.EndAt, &o.Status, &o.MaxUses, &o.CurrentUses,
        &o.BonusAllowed, &o.MaxBonusPercent, &o.CreatedAt, &o.UpdatedAt,
        &imageURL, &address, &phone, &website, &workingHours, &rejectionReason,
        &o.IsEvent, &organizerID, &o.EventPrivacy, &eventUniversityID,
        &adminEditedData, &adminEditComment, &partnerRejectComment,
        &latitude, &longitude, &placeName,
        &recurrenceRule, &recurrenceUntil,
    )
    if err != nil {
        return o, err
    }
    if companyID.Valid {
        o.CompanyID = &companyID.Int64
    }
    if organizerID.Valid {
        o.OrganizerID = &organizerID.Int64
    }
    if eventUniversityID.Valid {
        o.EventUniversityID = &eventUniversityID.Int64
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
    if rejectionReason.Valid {
        o.RejectionReason = &rejectionReason.String
    }
    if len(adminEditedData) > 0 {
        o.AdminEditedData = json.RawMessage(adminEditedData)
    }
    if adminEditComment.Valid {
        o.AdminEditComment = &adminEditComment.String
    }
    if partnerRejectComment.Valid {
        o.PartnerRejectComment = &partnerRejectComment.String
    }
    if latitude.Valid {
        o.Latitude = &latitude.Float64
    }
    if longitude.Valid {
        o.Longitude = &longitude.Float64
    }
    if placeName.Valid {
        o.PlaceName = &placeName.String
    }
    if recurrenceRule.Valid {
        o.RecurrenceRule = &recurrenceRule.String
    }
    if recurrenceUntil.Valid {
        o.RecurrenceUntil = &recurrenceUntil.Time
    }
    return o, nil
}

const offerColumns = `id, company_id, title, description, discount_type, discount_value, special_price, start_at, end_at, status, max_uses, current_uses, bonus_allowed, max_bonus_percent, created_at, updated_at, image_url, address, phone, website, working_hours, rejection_reason, is_event, organizer_id, event_privacy, event_university_id, admin_edited_data, admin_edit_comment, partner_reject_comment, latitude, longitude, place_name, recurrence_rule, recurrence_until`

// Та же последовательность, но с префиксом "o." (для запросов с алиасами)
const offerColumnsPrefixed = `o.id, o.company_id, o.title, o.description, o.discount_type, o.discount_value, o.special_price, o.start_at, o.end_at, o.status, o.max_uses, o.current_uses, o.bonus_allowed, o.max_bonus_percent, o.created_at, o.updated_at, o.image_url, o.address, o.phone, o.website, o.working_hours, o.rejection_reason, o.is_event, o.organizer_id, o.event_privacy, o.event_university_id, o.admin_edited_data, o.admin_edit_comment, o.partner_reject_comment, o.latitude, o.longitude, o.place_name, o.recurrence_rule, o.recurrence_until`

func (r *OfferRepo) Create(ctx context.Context, o *domain.Offer) error {
    query := `INSERT INTO offers (company_id, title, description, discount_type, discount_value, start_at, end_at, status, max_uses, current_uses, bonus_allowed, max_bonus_percent, image_url, address, phone, website, working_hours, is_event, organizer_id, event_privacy, event_university_id, latitude, longitude, place_name, recurrence_rule, recurrence_until) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26) RETURNING id, created_at, updated_at`

    eventPrivacy := o.EventPrivacy
    if eventPrivacy == "" {
        eventPrivacy = "public"
    }

    err := r.db.Pool.QueryRow(ctx, query,
        o.CompanyID, o.Title, o.Description, o.DiscountType, o.DiscountValue,
        o.StartAt, o.EndAt, o.Status, o.MaxUses, o.CurrentUses,
        o.BonusAllowed, o.MaxBonusPercent,
        o.ImageURL, o.Address, o.Phone, o.Website, o.WorkingHours,
        o.IsEvent, o.OrganizerID, eventPrivacy, o.EventUniversityID,
        o.Latitude, o.Longitude, o.PlaceName,
        o.RecurrenceRule, o.RecurrenceUntil,
    ).Scan(&o.ID, &o.CreatedAt, &o.UpdatedAt)
    if err != nil {
        log.Printf("OfferRepo.Create SQL error: %v", err)
    }
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
    baseQuery := `SELECT DISTINCT ` + offerColumnsPrefixed + `
              FROM offers o`

    where := []string{"o.status = 'published'", "o.is_event = false"}
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
    query := `UPDATE offers SET title=$1, description=$2, discount_type=$3, discount_value=$4, special_price=$5, start_at=$6, end_at=$7, status=$8, max_uses=$9, bonus_allowed=$10, max_bonus_percent=$11, image_url=$12, address=$13, phone=$14, website=$15, working_hours=$16, rejection_reason=$17, is_event=$18, organizer_id=$19, event_privacy=$20, event_university_id=$21, latitude=$22, longitude=$23, place_name=$24, recurrence_rule=$25, recurrence_until=$26, updated_at=NOW() WHERE id=$27`
    _, err := r.db.Pool.Exec(ctx, query,
        o.Title, o.Description, o.DiscountType, o.DiscountValue,
        o.SpecialPrice, o.StartAt, o.EndAt, o.Status, o.MaxUses,
        o.BonusAllowed, o.MaxBonusPercent,
        o.ImageURL, o.Address, o.Phone, o.Website, o.WorkingHours,
        o.RejectionReason,
        o.IsEvent, o.OrganizerID, o.EventPrivacy, o.EventUniversityID,
        o.Latitude, o.Longitude, o.PlaceName,
        o.RecurrenceRule, o.RecurrenceUntil,
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

func (r *OfferRepo) UpdateStatusWithReason(ctx context.Context, id int64, status string, reason string) error {
    query := `UPDATE offers SET status=$1, rejection_reason=$2, updated_at=NOW() WHERE id=$3`
    _, err := r.db.Pool.Exec(ctx, query, status, reason, id)
    return err
}

// ListEvents — список ивентов (is_event = true).
// organizerID != nil → только ивенты этого организатора.
// status="" → все статусы; status="published" → только опубликованные.
func (r *OfferRepo) ListEvents(ctx context.Context, organizerID *int64, status string, limit, offset int) ([]domain.Offer, error) {
    if limit <= 0 || limit > 200 {
        limit = 50
    }
    query := `SELECT ` + offerColumns + `,
        COALESCE((
            SELECT COUNT(*) FROM event_attendees ea
            WHERE ea.event_id = offers.id AND ea.status = 'going'
        ), 0) AS attendees_count
        FROM offers WHERE is_event = true`
    args := []interface{}{}
    argIdx := 1

    if organizerID != nil {
        query += " AND organizer_id = $" + strconv.Itoa(argIdx)
        args = append(args, *organizerID)
        argIdx++
    }
    if status != "" {
        query += " AND status = $" + strconv.Itoa(argIdx)
        args = append(args, status)
        argIdx++
    }
    query += " ORDER BY start_at ASC"
    query += " LIMIT $" + strconv.Itoa(argIdx) + " OFFSET $" + strconv.Itoa(argIdx+1)
    args = append(args, limit, offset)

    rows, err := r.db.Pool.Query(ctx, query, args...)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    result := make([]domain.Offer, 0)
    for rows.Next() {
        var o domain.Offer
        var imageURL, address, phone, website, workingHours, rejectionReason sql.NullString
        var companyID, organizerIDVal, eventUniversityID sql.NullInt64
        var adminEditedData []byte
        var adminEditComment, partnerRejectComment sql.NullString
        var latitude, longitude sql.NullFloat64
        var placeName, recurrenceRule sql.NullString
        var recurrenceUntil sql.NullTime

        err := rows.Scan(
            &o.ID, &companyID, &o.Title, &o.Description,
            &o.DiscountType, &o.DiscountValue, &o.SpecialPrice,
            &o.StartAt, &o.EndAt, &o.Status, &o.MaxUses, &o.CurrentUses,
            &o.BonusAllowed, &o.MaxBonusPercent, &o.CreatedAt, &o.UpdatedAt,
            &imageURL, &address, &phone, &website, &workingHours, &rejectionReason,
            &o.IsEvent, &organizerIDVal, &o.EventPrivacy, &eventUniversityID,
            &adminEditedData, &adminEditComment, &partnerRejectComment,
            &latitude, &longitude, &placeName,
            &recurrenceRule, &recurrenceUntil,
            &o.AttendeesCount,
        )
        if err != nil {
            return nil, err
        }
        if companyID.Valid {
            o.CompanyID = &companyID.Int64
        }
        if organizerIDVal.Valid {
            o.OrganizerID = &organizerIDVal.Int64
        }
        if eventUniversityID.Valid {
            o.EventUniversityID = &eventUniversityID.Int64
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
        if rejectionReason.Valid {
            o.RejectionReason = &rejectionReason.String
        }
        if len(adminEditedData) > 0 {
            o.AdminEditedData = adminEditedData
        }
        if adminEditComment.Valid {
            o.AdminEditComment = &adminEditComment.String
        }
        if partnerRejectComment.Valid {
            o.PartnerRejectComment = &partnerRejectComment.String
        }
        if latitude.Valid {
            o.Latitude = &latitude.Float64
        }
        if longitude.Valid {
            o.Longitude = &longitude.Float64
        }
        if placeName.Valid {
            o.PlaceName = &placeName.String
        }
        if recurrenceRule.Valid {
            o.RecurrenceRule = &recurrenceRule.String
        }
        if recurrenceUntil.Valid {
            o.RecurrenceUntil = &recurrenceUntil.Time
        }
        result = append(result, o)
    }
    if err := r.loadTags(ctx, result); err != nil {
        return nil, err
    }
    return result, rows.Err()
}

// SetAdminEdits сохраняет JSONB-снимок админских правок и переводит оффер
// в статус pending_partner_approval.
func (r *OfferRepo) SetAdminEdits(ctx context.Context, id int64, data []byte, comment string) error {
    query := `UPDATE offers
              SET admin_edited_data = $1,
                  admin_edit_comment = $2,
                  status = 'pending_partner_approval',
                  updated_at = NOW()
              WHERE id = $3`
    _, err := r.db.Pool.Exec(ctx, query, data, comment, id)
    return err
}

// ApplyAdminEdits применяет admin_edited_data к основной записи и публикует оффер.
func (r *OfferRepo) ApplyAdminEdits(ctx context.Context, id int64) error {
    query := `UPDATE offers SET
                  title = COALESCE(admin_edited_data->>'title', title),
                  description = COALESCE(admin_edited_data->>'description', description),
                  discount_type = COALESCE(admin_edited_data->>'discount_type', discount_type),
                  discount_value = COALESCE((admin_edited_data->>'discount_value')::numeric, discount_value),
                  special_price = COALESCE((admin_edited_data->>'special_price')::numeric, special_price),
                  start_at = COALESCE((admin_edited_data->>'start_at')::timestamptz, start_at),
                  end_at = COALESCE((admin_edited_data->>'end_at')::timestamptz, end_at),
                  bonus_allowed = COALESCE((admin_edited_data->>'bonus_allowed')::boolean, bonus_allowed),
                  max_bonus_percent = COALESCE((admin_edited_data->>'max_bonus_percent')::int, max_bonus_percent),
                  max_uses = COALESCE((admin_edited_data->>'max_uses')::int, max_uses),
                  address = COALESCE(admin_edited_data->>'address', address),
                  phone = COALESCE(admin_edited_data->>'phone', phone),
                  website = COALESCE(admin_edited_data->>'website', website),
                  working_hours = COALESCE(admin_edited_data->>'working_hours', working_hours),
                  image_url = COALESCE(admin_edited_data->>'image_url', image_url),
                  latitude = COALESCE((admin_edited_data->>'latitude')::double precision, latitude),
                  longitude = COALESCE((admin_edited_data->>'longitude')::double precision, longitude),
                  place_name = COALESCE(admin_edited_data->>'place_name', place_name),
                  admin_edited_data = NULL,
                  admin_edit_comment = NULL,
                  partner_reject_comment = NULL,
                  status = 'published',
                  updated_at = NOW()
              WHERE id = $1`
    _, err := r.db.Pool.Exec(ctx, query, id)
    return err
}

// ClearAdminEdits отклоняет правки админа, возвращает оффер на повторную модерацию.
func (r *OfferRepo) ClearAdminEdits(ctx context.Context, id int64, partnerComment string) error {
    query := `UPDATE offers
              SET admin_edited_data = NULL,
                  admin_edit_comment = NULL,
                  partner_reject_comment = $1,
                  status = 'pending_review',
                  updated_at = NOW()
              WHERE id = $2`
    _, err := r.db.Pool.Exec(ctx, query, partnerComment, id)
    return err
}
