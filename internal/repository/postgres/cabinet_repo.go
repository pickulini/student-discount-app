package postgres

import (
    "context"
    "database/sql"
    "errors"
    "fmt"
    "strings"
    "time"

    "github.com/jackc/pgx/v5"
    "your-project/internal/domain"
)

// CabinetRepo — запросы для кабинета партнёра и витрины, которые не укладываются
// в CRUD-репозитории: агрегаты по компаниям, касса, обогащение офферов.
type CabinetRepo struct {
    db *DB
}

func NewCabinetRepo(db *DB) *CabinetRepo {
    return &CabinetRepo{db: db}
}

// ---------- Общие типы ----------

type CabinetCompany struct {
    ID            int64                `json:"id"`
    Name          string               `json:"name"`
    Description   string               `json:"description"`
    IsActive      bool                 `json:"is_active"`
    CategoryLabel string               `json:"category_label"`
    CoverImage    *string              `json:"cover_image,omitempty"`
    Locations     []CabinetLocation    `json:"locations"`
    Balance       float64              `json:"balance"`
    OffersTotal   int                  `json:"offers_total"`
    OffersActive  int                  `json:"offers_active"`
    EventsTotal   int                  `json:"events_total"`
    Subscribers   int                  `json:"subscribers"`
    Redeemed30d   int                  `json:"redeemed_30d"`
}

type CabinetLocation struct {
    ID      int64  `json:"id"`
    Name    string `json:"name"`
    Address string `json:"address"`
}

type DailyCount struct {
    Date  string `json:"date"` // YYYY-MM-DD
    Count int    `json:"count"`
}

type CabinetTx struct {
    ID          int64     `json:"id"`
    CreatedAt   time.Time `json:"created_at"`
    Type        string    `json:"type"`
    Status      string    `json:"status"`
    Description string    `json:"description"`
    Amount      float64   `json:"amount"`
    OrderID     *int64    `json:"order_id,omitempty"`
    OfferTitle  string    `json:"offer_title"`
    CompanyID   int64     `json:"company_id"`
    CompanyName string    `json:"company_name"`
    RefundNote  string    `json:"refund_note,omitempty"`
}

// ---------- Компании пользователя ----------

// UserCompanyIDs возвращает id компаний, к которым привязан партнёр.
func (r *CabinetRepo) UserCompanyIDs(ctx context.Context, userID int64) ([]int64, error) {
    rows, err := r.db.Pool.Query(ctx, `SELECT company_id FROM company_users WHERE user_id = $1 ORDER BY company_id`, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    ids := []int64{}
    for rows.Next() {
        var id int64
        if err := rows.Scan(&id); err != nil {
            return nil, err
        }
        ids = append(ids, id)
    }
    return ids, rows.Err()
}

// Companies — подробная карточка каждой компании (экран «Мои компании»).
func (r *CabinetRepo) Companies(ctx context.Context, ids []int64) ([]CabinetCompany, error) {
    out := []CabinetCompany{}
    if len(ids) == 0 {
        return out, nil
    }
    rows, err := r.db.Pool.Query(ctx, `
        SELECT c.id, c.name, COALESCE(c.description, ''), COALESCE(c.is_active, true),
               COALESCE(ma.balance, 0),
               (SELECT COUNT(*) FROM offers o WHERE o.company_id = c.id AND o.is_event = false),
               (SELECT COUNT(*) FROM offers o WHERE o.company_id = c.id AND o.is_event = false AND o.status = 'published' AND o.end_at > NOW()),
               (SELECT COUNT(*) FROM offers o WHERE o.company_id = c.id AND o.is_event = true),
               (SELECT COUNT(*) FROM company_subscriptions s WHERE s.company_id = c.id),
               (SELECT COUNT(*) FROM orders od WHERE od.company_id = c.id AND od.status = 'completed'
                    AND COALESCE(od.redeemed_at, od.completed_at, od.updated_at) > NOW() - INTERVAL '30 days'),
               (SELECT o.image_url FROM offers o WHERE o.company_id = c.id AND o.image_url IS NOT NULL AND o.image_url <> ''
                    ORDER BY (o.status = 'published') DESC, o.id DESC LIMIT 1),
               COALESCE((SELECT t.name FROM offer_tags ot JOIN tags t ON t.id = ot.tag_id JOIN offers o ON o.id = ot.offer_id
                    WHERE o.company_id = c.id GROUP BY t.name ORDER BY COUNT(*) DESC, t.name LIMIT 1), '')
        FROM companies c
        LEFT JOIN merchant_accounts ma ON ma.company_id = c.id
        WHERE c.id = ANY($1)
        ORDER BY c.id`, ids)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    for rows.Next() {
        var c CabinetCompany
        var cover sql.NullString
        if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.IsActive, &c.Balance,
            &c.OffersTotal, &c.OffersActive, &c.EventsTotal, &c.Subscribers, &c.Redeemed30d,
            &cover, &c.CategoryLabel); err != nil {
            return nil, err
        }
        if cover.Valid {
            c.CoverImage = &cover.String
        }
        c.Locations = []CabinetLocation{}
        out = append(out, c)
    }
    if err := rows.Err(); err != nil {
        return nil, err
    }
    lrows, err := r.db.Pool.Query(ctx, `
        SELECT id, company_id, COALESCE(name, ''), address FROM company_locations
        WHERE company_id = ANY($1) AND COALESCE(is_active, true) ORDER BY id`, ids)
    if err != nil {
        return nil, err
    }
    defer lrows.Close()
    byID := map[int64]int{}
    for i := range out {
        byID[out[i].ID] = i
    }
    for lrows.Next() {
        var l CabinetLocation
        var companyID int64
        if err := lrows.Scan(&l.ID, &companyID, &l.Name, &l.Address); err != nil {
            return nil, err
        }
        if i, ok := byID[companyID]; ok {
            out[i].Locations = append(out[i].Locations, l)
        }
    }
    return out, lrows.Err()
}

// ---------- Деньги ----------

type MoneySummary struct {
    Balance         float64 `json:"balance"`
    Credited        float64 `json:"credited"`
    Refunds         float64 `json:"refunds"`
    RefundsCount    int     `json:"refunds_count"`
    PaidOut         float64 `json:"paid_out"`
    Net             float64 `json:"net"`
    AvgCheck        float64 `json:"avg_check"`
    AvgDiscountPct  float64 `json:"avg_discount_pct"`
}

func (r *CabinetRepo) Money(ctx context.Context, ids []int64, from, to time.Time) (MoneySummary, error) {
    var m MoneySummary
    if len(ids) == 0 {
        return m, nil
    }
    err := r.db.Pool.QueryRow(ctx, `SELECT COALESCE(SUM(balance), 0) FROM merchant_accounts WHERE company_id = ANY($1)`, ids).Scan(&m.Balance)
    if err != nil {
        return m, err
    }
    err = r.db.Pool.QueryRow(ctx, `
        SELECT
            COALESCE(SUM(amount) FILTER (WHERE type = 'order_earning'), 0),
            COALESCE(SUM(amount) FILTER (WHERE type = 'refund'), 0),
            COUNT(*) FILTER (WHERE type = 'refund'),
            COALESCE(SUM(amount) FILTER (WHERE type = 'settlement'), 0)
        FROM merchant_transactions
        WHERE company_id = ANY($1) AND created_at >= $2 AND created_at < $3`, ids, from, to).
        Scan(&m.Credited, &m.Refunds, &m.RefundsCount, &m.PaidOut)
    if err != nil {
        return m, err
    }
    m.Net = m.Credited + m.Refunds
    err = r.db.Pool.QueryRow(ctx, `
        SELECT COALESCE(AVG(subtotal - discount_amount), 0),
               COALESCE(AVG(CASE WHEN subtotal > 0 THEN discount_amount / subtotal * 100 END), 0)
        FROM orders
        WHERE company_id = ANY($1) AND status IN ('paid', 'completed') AND created_at >= $2 AND created_at < $3`, ids, from, to).
        Scan(&m.AvgCheck, &m.AvgDiscountPct)
    return m, err
}

// Transactions — движения денег по компаниям с фильтрами и пагинацией.
func (r *CabinetRepo) Transactions(ctx context.Context, ids []int64, kind string, from, to time.Time, limit, offset int) ([]CabinetTx, int, float64, error) {
    out := []CabinetTx{}
    if len(ids) == 0 {
        return out, 0, 0, nil
    }
    where := []string{"mt.company_id = ANY($1)", "mt.created_at >= $2", "mt.created_at < $3"}
    switch kind {
    case "earning":
        where = append(where, "mt.type = 'order_earning'")
    case "payout":
        where = append(where, "mt.type = 'settlement'")
    case "refund":
        where = append(where, "mt.type = 'refund'")
    }
    cond := strings.Join(where, " AND ")
    var total int
    var sum float64
    if err := r.db.Pool.QueryRow(ctx, `SELECT COUNT(*), COALESCE(SUM(mt.amount), 0) FROM merchant_transactions mt WHERE `+cond, ids, from, to).Scan(&total, &sum); err != nil {
        return nil, 0, 0, err
    }
    rows, err := r.db.Pool.Query(ctx, `
        SELECT mt.id, mt.created_at, mt.type, mt.status, COALESCE(mt.description, ''), mt.amount, mt.order_id,
               COALESCE(o.title, ''), mt.company_id, c.name
        FROM merchant_transactions mt
        JOIN companies c ON c.id = mt.company_id
        LEFT JOIN orders od ON od.id = mt.order_id
        LEFT JOIN offers o ON o.id = od.offer_id
        WHERE `+cond+`
        ORDER BY mt.created_at DESC, mt.id DESC
        LIMIT $4 OFFSET $5`, ids, from, to, limit, offset)
    if err != nil {
        return nil, 0, 0, err
    }
    defer rows.Close()
    for rows.Next() {
        var t CabinetTx
        if err := rows.Scan(&t.ID, &t.CreatedAt, &t.Type, &t.Status, &t.Description, &t.Amount, &t.OrderID,
            &t.OfferTitle, &t.CompanyID, &t.CompanyName); err != nil {
            return nil, 0, 0, err
        }
        out = append(out, t)
    }
    return out, total, sum, rows.Err()
}

// ---------- Использования и погашения по дням ----------

// DailyOrders считает заказы по дням. redeemed=true — погашенные на кассе
// (по дате погашения), иначе — все оплаченные (по дате заказа).
func (r *CabinetRepo) DailyOrders(ctx context.Context, ids []int64, from, to time.Time, redeemed bool) ([]DailyCount, error) {
    dateExpr := "od.created_at"
    statusCond := "od.status IN ('paid', 'completed')"
    if redeemed {
        dateExpr = "COALESCE(od.redeemed_at, od.completed_at, od.updated_at)"
        statusCond = "od.status = 'completed'"
    }
    counts := map[string]int{}
    if len(ids) > 0 {
        rows, err := r.db.Pool.Query(ctx, `
            SELECT to_char(`+dateExpr+` AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD') AS d, COUNT(*)
            FROM orders od
            WHERE od.company_id = ANY($1) AND `+statusCond+` AND `+dateExpr+` >= $2 AND `+dateExpr+` < $3
            GROUP BY d`, ids, from, to)
        if err != nil {
            return nil, err
        }
        defer rows.Close()
        for rows.Next() {
            var d string
            var n int
            if err := rows.Scan(&d, &n); err != nil {
                return nil, err
            }
            counts[d] = n
        }
        if err := rows.Err(); err != nil {
            return nil, err
        }
    }
    loc := moscow()
    out := []DailyCount{}
    for d := from.In(loc); d.Before(to); d = d.AddDate(0, 0, 1) {
        key := d.Format("2006-01-02")
        out = append(out, DailyCount{Date: key, Count: counts[key]})
    }
    return out, nil
}

// CountOrders — число заказов за период (для сравнения с прошлым периодом).
func (r *CabinetRepo) CountOrders(ctx context.Context, ids []int64, from, to time.Time, redeemed bool) (int, error) {
    if len(ids) == 0 {
        return 0, nil
    }
    dateExpr := "created_at"
    statusCond := "status IN ('paid', 'completed')"
    if redeemed {
        dateExpr = "COALESCE(redeemed_at, completed_at, updated_at)"
        statusCond = "status = 'completed'"
    }
    var n int
    err := r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE company_id = ANY($1) AND `+statusCond+
        ` AND `+dateExpr+` >= $2 AND `+dateExpr+` < $3`, ids, from, to).Scan(&n)
    return n, err
}

type TopOffer struct {
    OfferID     int64   `json:"offer_id"`
    Title       string  `json:"title"`
    CompanyName string  `json:"company_name"`
    Count       int     `json:"count"`
    Revenue     float64 `json:"revenue"`
}

func (r *CabinetRepo) TopOffers(ctx context.Context, ids []int64, from, to time.Time, limit int) ([]TopOffer, error) {
    out := []TopOffer{}
    if len(ids) == 0 {
        return out, nil
    }
    rows, err := r.db.Pool.Query(ctx, `
        SELECT o.id, o.title, c.name, COUNT(od.id), COALESCE(SUM(od.total_amount - od.commission), 0)
        FROM orders od
        JOIN offers o ON o.id = od.offer_id
        JOIN companies c ON c.id = od.company_id
        WHERE od.company_id = ANY($1) AND od.status IN ('paid', 'completed') AND o.is_event = false
          AND od.created_at >= $2 AND od.created_at < $3
        GROUP BY o.id, o.title, c.name
        ORDER BY COUNT(od.id) DESC, o.id
        LIMIT $4`, ids, from, to, limit)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    for rows.Next() {
        var t TopOffer
        if err := rows.Scan(&t.OfferID, &t.Title, &t.CompanyName, &t.Count, &t.Revenue); err != nil {
            return nil, err
        }
        out = append(out, t)
    }
    return out, rows.Err()
}

type OfferStatusCounts struct {
    Total     int `json:"total"`
    Published int `json:"published"`
    Pending   int `json:"pending"`
    Draft     int `json:"draft"`
    Waiting   int `json:"waiting"`
    Rejected  int `json:"rejected"`
}

func (r *CabinetRepo) OfferCounts(ctx context.Context, ids []int64) (OfferStatusCounts, error) {
    var c OfferStatusCounts
    if len(ids) == 0 {
        return c, nil
    }
    err := r.db.Pool.QueryRow(ctx, `
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE status = 'published' AND end_at > NOW()),
               COUNT(*) FILTER (WHERE status = 'pending_review'),
               COUNT(*) FILTER (WHERE status = 'draft'),
               COUNT(*) FILTER (WHERE status = 'pending_partner_approval'),
               COUNT(*) FILTER (WHERE status = 'rejected')
        FROM offers WHERE company_id = ANY($1) AND is_event = false`, ids).
        Scan(&c.Total, &c.Published, &c.Pending, &c.Draft, &c.Waiting, &c.Rejected)
    return c, err
}

type EventRank struct {
    EventID int64  `json:"event_id"`
    Title   string `json:"title"`
    Count   int    `json:"count"`
}

type EventSummary struct {
    Total        int         `json:"total"`
    Going        int         `json:"going"`
    Interested   int         `json:"interested"`
    TopGoing     []EventRank `json:"top_going"`
    TopInterest  []EventRank `json:"top_interested"`
}

// Events — ивенты компаний партнёра и ивенты, где он организатор.
func (r *CabinetRepo) Events(ctx context.Context, userID int64, ids []int64, from, to time.Time) (EventSummary, error) {
    s := EventSummary{TopGoing: []EventRank{}, TopInterest: []EventRank{}}
    rows, err := r.db.Pool.Query(ctx, `
        SELECT o.id, o.title,
               (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = o.id AND ea.status = 'going'
                    AND ea.updated_at >= $3 AND ea.updated_at < $4),
               (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = o.id AND ea.status = 'interested'
                    AND ea.updated_at >= $3 AND ea.updated_at < $4)
        FROM offers o
        WHERE o.is_event = true AND (o.company_id = ANY($1) OR (o.company_id IS NULL AND o.organizer_id = $2))
        ORDER BY o.id`, ids, userID, from, to)
    if err != nil {
        return s, err
    }
    defer rows.Close()
    var all []struct {
        id          int64
        title       string
        going, intr int
    }
    for rows.Next() {
        var e struct {
            id          int64
            title       string
            going, intr int
        }
        if err := rows.Scan(&e.id, &e.title, &e.going, &e.intr); err != nil {
            return s, err
        }
        all = append(all, e)
        s.Total++
        s.Going += e.going
        s.Interested += e.intr
    }
    if err := rows.Err(); err != nil {
        return s, err
    }
    top := func(get func(i int) int) []EventRank {
        idx := make([]int, len(all))
        for i := range idx {
            idx[i] = i
        }
        for i := 0; i < len(idx); i++ {
            for j := i + 1; j < len(idx); j++ {
                if get(idx[j]) > get(idx[i]) {
                    idx[i], idx[j] = idx[j], idx[i]
                }
            }
        }
        res := []EventRank{}
        for _, i := range idx {
            if len(res) == 3 || get(i) == 0 {
                break
            }
            res = append(res, EventRank{EventID: all[i].id, Title: all[i].title, Count: get(i)})
        }
        return res
    }
    s.TopGoing = top(func(i int) int { return all[i].going })
    s.TopInterest = top(func(i int) int { return all[i].intr })
    return s, nil
}

// Attention — офферы, которые требуют действий партнёра.
type AttentionItem struct {
    OfferID int64  `json:"offer_id"`
    Title   string `json:"title"`
    Status  string `json:"status"`
    Note    string `json:"note"`
}

func (r *CabinetRepo) Attention(ctx context.Context, ids []int64) ([]AttentionItem, error) {
    out := []AttentionItem{}
    if len(ids) == 0 {
        return out, nil
    }
    rows, err := r.db.Pool.Query(ctx, `
        SELECT id, title, status, COALESCE(CASE WHEN status = 'rejected' THEN rejection_reason ELSE admin_edit_comment END, '')
        FROM offers
        WHERE company_id = ANY($1) AND status IN ('pending_partner_approval', 'rejected')
        ORDER BY (status = 'pending_partner_approval') DESC, updated_at DESC
        LIMIT 5`, ids)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    for rows.Next() {
        var a AttentionItem
        if err := rows.Scan(&a.OfferID, &a.Title, &a.Status, &a.Note); err != nil {
            return nil, err
        }
        out = append(out, a)
    }
    return out, rows.Err()
}

// ---------- Касса ----------

type RedeemOrder struct {
    ID               int64      `json:"id"`
    Code             string     `json:"code"`
    RedeemCode       string     `json:"redeem_code"`
    Status           string     `json:"status"`
    CompanyID        int64      `json:"company_id"`
    CompanyName      string     `json:"company_name"`
    LocationID       *int64     `json:"location_id,omitempty"`
    LocationAddress  string     `json:"location_address,omitempty"`
    OfferID          int64      `json:"offer_id"`
    OfferTitle       string     `json:"offer_title"`
    OfferEndAt       time.Time  `json:"offer_end_at"`
    DiscountType     string     `json:"discount_type"`
    DiscountValue    float64    `json:"discount_value"`
    Subtotal         float64    `json:"subtotal"`
    DiscountAmount   float64    `json:"discount_amount"`
    BonusAmount      float64    `json:"bonus_amount"`
    TotalAmount      float64    `json:"total_amount"`
    MerchantAmount   float64    `json:"merchant_amount"`
    CreatedAt        time.Time  `json:"created_at"`
    PaidAt           *time.Time `json:"paid_at,omitempty"`
    RedeemedAt       *time.Time `json:"redeemed_at,omitempty"`
    RedeemedAddress  string     `json:"redeemed_address,omitempty"`
    StudentName      string     `json:"student_name"`
    StudentAvatar    *string    `json:"student_avatar,omitempty"`
    StudentUniversity string    `json:"student_university"`
    StudentVerified  bool       `json:"student_verified"`
    StudentVerifiedUntil *time.Time `json:"student_verified_until,omitempty"`
}

// FormatOrderCode — «0512 · KX7Q».
func FormatOrderCode(id int64, redeem string) string {
    return fmt.Sprintf("%04d · %s", id%10000, redeem)
}

var ErrCodeFormat = errors.New("bad code format")

// ParseOrderCode принимает «0512 · KX7Q», «0512KX7Q», «0512-kx7q».
func ParseOrderCode(raw string) (int64, string, error) {
    var b strings.Builder
    for _, ch := range strings.ToUpper(raw) {
        if (ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z') {
            b.WriteRune(ch)
        }
    }
    s := b.String()
    if len(s) != 8 {
        return 0, "", ErrCodeFormat
    }
    var digits int64
    for _, ch := range s[:4] {
        if ch < '0' || ch > '9' {
            return 0, "", ErrCodeFormat
        }
        digits = digits*10 + int64(ch-'0')
    }
    return digits, s[4:], nil
}

const redeemSelect = `
    SELECT od.id, od.redeem_code, od.status, COALESCE(od.company_id, 0), COALESCE(c.name, ''),
           od.location_id, COALESCE(cl.address, ''),
           od.offer_id, COALESCE(o.title, ''), o.end_at, o.discount_type, o.discount_value,
           od.subtotal, od.discount_amount, od.bonus_amount, od.total_amount, od.commission,
           od.created_at, od.redeemed_at, COALESCE(rl.address, ''),
           COALESCE(NULLIF(u.nickname, ''), u.full_name), u.avatar_url,
           COALESCE(NULLIF(un.short_name, ''), un.name, ''), u.student_status = 'verified',
           (SELECT sv.expires_at FROM student_verifications sv WHERE sv.user_id = u.id AND sv.status = 'verified'
               ORDER BY sv.verified_at DESC NULLS LAST, sv.id DESC LIMIT 1)
    FROM orders od
    JOIN users u ON u.id = od.user_id
    LEFT JOIN universities un ON un.id = u.university_id
    LEFT JOIN offers o ON o.id = od.offer_id
    LEFT JOIN companies c ON c.id = od.company_id
    LEFT JOIN company_locations cl ON cl.id = od.location_id
    LEFT JOIN company_locations rl ON rl.id = od.redeemed_location_id`

func scanRedeem(row pgx.Row) (*RedeemOrder, error) {
    var ro RedeemOrder
    var endAt sql.NullTime
    var commission float64
    var discountType sql.NullString
    var discountValue sql.NullFloat64
    err := row.Scan(&ro.ID, &ro.RedeemCode, &ro.Status, &ro.CompanyID, &ro.CompanyName,
        &ro.LocationID, &ro.LocationAddress,
        &ro.OfferID, &ro.OfferTitle, &endAt, &discountType, &discountValue,
        &ro.Subtotal, &ro.DiscountAmount, &ro.BonusAmount, &ro.TotalAmount, &commission,
        &ro.CreatedAt, &ro.RedeemedAt, &ro.RedeemedAddress,
        &ro.StudentName, &ro.StudentAvatar, &ro.StudentUniversity, &ro.StudentVerified,
        &ro.StudentVerifiedUntil)
    if err != nil {
        return nil, err
    }
    if endAt.Valid {
        ro.OfferEndAt = endAt.Time
    }
    ro.DiscountType = discountType.String
    ro.DiscountValue = discountValue.Float64
    // Деньги списываются в момент оформления заказа — это и есть время оплаты.
    paid := ro.CreatedAt
    ro.PaidAt = &paid
    ro.MerchantAmount = ro.TotalAmount - commission
    ro.Code = FormatOrderCode(ro.ID, ro.RedeemCode)
    return &ro, nil
}

// FindByCode ищет заказ по коду из чека (без проверки принадлежности компании).
func (r *CabinetRepo) FindByCode(ctx context.Context, digits int64, redeem string) (*RedeemOrder, error) {
    row := r.db.Pool.QueryRow(ctx, redeemSelect+`
        WHERE od.redeem_code = $1 AND od.id % 10000 = $2
        ORDER BY od.id DESC LIMIT 1`, redeem, digits)
    ro, err := scanRedeem(row)
    if errors.Is(err, pgx.ErrNoRows) {
        return nil, nil
    }
    return ro, err
}

func (r *CabinetRepo) OrderForRedeem(ctx context.Context, orderID int64) (*RedeemOrder, error) {
    row := r.db.Pool.QueryRow(ctx, redeemSelect+` WHERE od.id = $1`, orderID)
    ro, err := scanRedeem(row)
    if errors.Is(err, pgx.ErrNoRows) {
        return nil, nil
    }
    return ro, err
}

// MarkRedeemed — погашение: paid → completed. Возвращает false, если заказ уже не в статусе paid.
func (r *CabinetRepo) MarkRedeemed(ctx context.Context, orderID, userID int64, locationID *int64) (bool, error) {
    tag, err := r.db.Pool.Exec(ctx, `
        UPDATE orders
        SET status = 'completed', redeemed_at = NOW(), completed_at = NOW(), redeemed_by = $2,
            redeemed_location_id = $3, updated_at = NOW()
        WHERE id = $1 AND status = 'paid'`, orderID, userID, locationID)
    if err != nil {
        return false, err
    }
    return tag.RowsAffected() == 1, nil
}

type RedeemedRow struct {
    ID         int64     `json:"id"`
    RedeemedAt time.Time `json:"redeemed_at"`
    Student    string    `json:"student"`
    University string    `json:"university"`
    Code       string    `json:"code"`
    Amount     float64   `json:"amount"`
}

func (r *CabinetRepo) RedeemedBetween(ctx context.Context, ids []int64, from, to time.Time) ([]RedeemedRow, error) {
    out := []RedeemedRow{}
    if len(ids) == 0 {
        return out, nil
    }
    rows, err := r.db.Pool.Query(ctx, `
        SELECT od.id, od.redeemed_at, u.full_name, COALESCE(NULLIF(un.short_name, ''), un.name, ''), od.redeem_code,
               od.subtotal - od.discount_amount
        FROM orders od
        JOIN users u ON u.id = od.user_id
        LEFT JOIN universities un ON un.id = u.university_id
        WHERE od.company_id = ANY($1) AND od.redeemed_at >= $2 AND od.redeemed_at < $3
        ORDER BY od.redeemed_at DESC`, ids, from, to)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    for rows.Next() {
        var rr RedeemedRow
        var redeem string
        if err := rows.Scan(&rr.ID, &rr.RedeemedAt, &rr.Student, &rr.University, &redeem, &rr.Amount); err != nil {
            return nil, err
        }
        rr.Student = shortName(rr.Student)
        rr.Code = FormatOrderCode(rr.ID, redeem)
        out = append(out, rr)
    }
    return out, rows.Err()
}

// shortName: «Анна Петрова» → «А. Петрова».
func shortName(full string) string {
    parts := strings.Fields(full)
    if len(parts) < 2 {
        return full
    }
    first := []rune(parts[0])
    return string(first[0]) + ". " + strings.Join(parts[1:], " ")
}

// ---------- Витрина: обогащение офферов ----------

// EnrichOffers добавляет название компании, галерею и автора правок.
func (r *CabinetRepo) EnrichOffers(ctx context.Context, offers []domain.Offer) error {
    if len(offers) == 0 {
        return nil
    }
    ids := make([]int64, 0, len(offers))
    for _, o := range offers {
        ids = append(ids, o.ID)
    }
    rows, err := r.db.Pool.Query(ctx, `
        SELECT o.id, c.name, COALESCE(o.gallery, '{}'), COALESCE(NULLIF(eu.nickname, ''), eu.full_name), o.admin_edited_at
        FROM offers o
        LEFT JOIN companies c ON c.id = o.company_id
        LEFT JOIN users eu ON eu.id = o.admin_edited_by
        WHERE o.id = ANY($1)`, ids)
    if err != nil {
        return err
    }
    defer rows.Close()
    type extra struct {
        company *string
        gallery []string
        editor  *string
        editAt  *time.Time
    }
    m := map[int64]extra{}
    for rows.Next() {
        var id int64
        var e extra
        if err := rows.Scan(&id, &e.company, &e.gallery, &e.editor, &e.editAt); err != nil {
            return err
        }
        m[id] = e
    }
    if err := rows.Err(); err != nil {
        return err
    }
    for i := range offers {
        if e, ok := m[offers[i].ID]; ok {
            offers[i].CompanyName = e.company
            if len(e.gallery) > 0 {
                offers[i].Gallery = e.gallery
            }
            offers[i].AdminEditedByName = e.editor
            offers[i].AdminEditedAt = e.editAt
        }
    }
    return nil
}

// ---------- Время ----------

func moscow() *time.Location {
    loc, err := time.LoadLocation("Europe/Moscow")
    if err != nil {
        return time.FixedZone("MSK", 3*3600)
    }
    return loc
}

// StartOfDayMSK — начало суток по Москве.
func StartOfDayMSK(t time.Time) time.Time {
    loc := moscow()
    tt := t.In(loc)
    return time.Date(tt.Year(), tt.Month(), tt.Day(), 0, 0, 0, 0, loc)
}

// UserExtras — поля профиля, которых нет в domain.User-запросе: курс, вуз,
// срок студенческого статуса (для верхней строки «АННА · МГУ ✓» и профиля).
func (r *CabinetRepo) UserExtras(ctx context.Context, userID int64) map[string]interface{} {
    var course sql.NullInt64
    var uniName, uniShort sql.NullString
    var expires sql.NullTime
    var searchable bool
    err := r.db.Pool.QueryRow(ctx, `
        SELECT u.course, un.name, un.short_name, COALESCE(u.searchable, true),
               (SELECT sv.expires_at FROM student_verifications sv
                 WHERE sv.user_id = u.id AND sv.status = 'verified'
                 ORDER BY sv.verified_at DESC NULLS LAST, sv.id DESC LIMIT 1)
        FROM users u LEFT JOIN universities un ON un.id = u.university_id
        WHERE u.id = $1`, userID).Scan(&course, &uniName, &uniShort, &searchable, &expires)
    out := map[string]interface{}{}
    if err != nil {
        return out
    }
    out["searchable"] = searchable
    if course.Valid {
        out["course"] = course.Int64
    }
    if uniName.Valid {
        out["university_name"] = uniName.String
    }
    if uniShort.Valid && strings.TrimSpace(uniShort.String) != "" {
        out["university_short"] = strings.TrimSpace(uniShort.String)
    } else if uniName.Valid && uniName.String != "" {
        out["university_short"] = abbreviate(uniName.String)
    }
    if expires.Valid {
        out["student_verification_expires_at"] = expires.Time
    }
    return out
}

// abbreviate: «Высшая школа экономики» → «ВШЭ». Служебные слова пропускаются.
func abbreviate(name string) string {
    skip := map[string]bool{"и": true, "им.": true, "имени": true, "по": true, "в": true, "на": true}
    var b strings.Builder
    for _, w := range strings.Fields(strings.NewReplacer("«", " ", "»", " ", "\"", " ", "-", " ").Replace(name)) {
        if skip[strings.ToLower(w)] {
            continue
        }
        r := []rune(w)
        b.WriteString(strings.ToUpper(string(r[0])))
        if b.Len() >= 12 {
            break
        }
    }
    return b.String()
}

// ---------- Публичная статистика (экраны входа и регистрации) ----------

type PublicStats struct {
    WeekSaved float64 `json:"week_saved"`
    Places    int     `json:"places"`
    Offers    int     `json:"offers"`
}

// PublicStats — сколько студенты сэкономили за 7 дней и в скольких местах
// сейчас есть действующие скидки.
func (r *CabinetRepo) PublicStats(ctx context.Context) (PublicStats, error) {
    var s PublicStats
    err := r.db.Pool.QueryRow(ctx, `
        SELECT COALESCE(SUM(subtotal - total_amount), 0)
        FROM orders
        WHERE status IN ('paid','completed') AND created_at >= NOW() - INTERVAL '7 days'`).Scan(&s.WeekSaved)
    if err != nil {
        return s, err
    }
    err = r.db.Pool.QueryRow(ctx, `
        SELECT COUNT(DISTINCT company_id), COUNT(*)
        FROM offers
        WHERE status = 'published' AND start_at <= NOW() AND end_at >= NOW()`).Scan(&s.Places, &s.Offers)
    return s, err
}

// ---------- Заявка студента на верификацию ----------

type MyVerification struct {
    ID                int64      `json:"id"`
    Status            string     `json:"status"`
    UniversityID      *int64     `json:"university_id,omitempty"`
    UniversityName    string     `json:"university_name,omitempty"`
    StudentIdentifier string     `json:"student_identifier,omitempty"`
    HasDocument       bool       `json:"has_document"`
    HasSelfie         bool       `json:"has_selfie"`
    RejectionReason   string     `json:"rejection_reason,omitempty"`
    CreatedAt         time.Time  `json:"created_at"`
    UpdatedAt         time.Time  `json:"updated_at"`
    VerifiedAt        *time.Time `json:"verified_at,omitempty"`
    ExpiresAt         *time.Time `json:"expires_at,omitempty"`
}

// LatestVerification — последняя заявка пользователя (nil, если заявок не было).
func (r *CabinetRepo) LatestVerification(ctx context.Context, userID int64) (*MyVerification, error) {
    v := &MyVerification{}
    err := r.db.Pool.QueryRow(ctx, `
        SELECT sv.id, sv.status, sv.university_id, COALESCE(u.name, ''), COALESCE(sv.student_identifier, ''),
               COALESCE(sv.document_key, '') <> '', COALESCE(sv.selfie_key, '') <> '',
               COALESCE(sv.rejection_reason, ''), COALESCE(sv.created_at, NOW()), COALESCE(sv.updated_at, sv.created_at, NOW()),
               sv.verified_at, sv.expires_at
        FROM student_verifications sv
        LEFT JOIN universities u ON u.id = sv.university_id
        WHERE sv.user_id = $1
        ORDER BY sv.created_at DESC, sv.id DESC
        LIMIT 1`, userID).Scan(&v.ID, &v.Status, &v.UniversityID, &v.UniversityName, &v.StudentIdentifier,
        &v.HasDocument, &v.HasSelfie, &v.RejectionReason, &v.CreatedAt, &v.UpdatedAt, &v.VerifiedAt, &v.ExpiresAt)
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return nil, nil
        }
        return nil, err
    }
    return v, nil
}

// ---------- Ивенты: подписи и друзья ----------

type EventPerson struct {
    ID        int64   `json:"id"`
    FullName  string  `json:"full_name"`
    Username  *string `json:"username,omitempty"`
    AvatarURL *string `json:"avatar_url,omitempty"`
}

type EventMeta struct {
    CompanyID         *int64       `json:"company_id,omitempty"`
    CompanyName       string       `json:"company_name,omitempty"`
    CompanyLogo       *string      `json:"company_logo,omitempty"`
    CompanyEventsWeek int          `json:"company_events_week"`
    Organizer         *EventPerson `json:"organizer,omitempty"`
    MaxUses           *int         `json:"max_uses,omitempty"`
    SpecialPrice      *float64     `json:"special_price,omitempty"`
    MyStatus          *string      `json:"my_status,omitempty"`
}

// EventsMeta — название места/организатора и лимит мест для набора ивентов.
func (r *CabinetRepo) EventsMeta(ctx context.Context, userID int64, ids []int64) (map[int64]*EventMeta, error) {
    out := map[int64]*EventMeta{}
    if len(ids) == 0 {
        return out, nil
    }
    rows, err := r.db.Pool.Query(ctx, `
        SELECT o.id, o.company_id, COALESCE(c.name, ''), c.logo_key,
               COALESCE((SELECT COUNT(*) FROM offers e
                         WHERE e.company_id = o.company_id AND e.is_event AND e.status = 'published'
                           AND e.end_at >= NOW() AND e.start_at < NOW() + INTERVAL '7 days'), 0),
               u.id, COALESCE(NULLIF(u.nickname, ''), u.full_name, ''), u.username, u.avatar_url,
               o.max_uses, o.special_price, me.status
        FROM offers o
        LEFT JOIN companies c ON c.id = o.company_id
        LEFT JOIN users u ON u.id = o.organizer_id
        LEFT JOIN event_attendees me ON me.event_id = o.id AND me.user_id = $2
        WHERE o.id = ANY($1) AND o.is_event`, ids, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    for rows.Next() {
        var id int64
        m := &EventMeta{}
        var uid *int64
        var uname string
        var username, avatar *string
        if err := rows.Scan(&id, &m.CompanyID, &m.CompanyName, &m.CompanyLogo, &m.CompanyEventsWeek,
            &uid, &uname, &username, &avatar, &m.MaxUses, &m.SpecialPrice, &m.MyStatus); err != nil {
            return nil, err
        }
        if uid != nil {
            m.Organizer = &EventPerson{ID: *uid, FullName: uname, Username: username, AvatarURL: avatar}
        }
        out[id] = m
    }
    return out, rows.Err()
}

type FriendAtEvent struct {
    EventID int64       `json:"event_id"`
    Status  string      `json:"status"`
    User    EventPerson `json:"user"`
}

// FriendsAtEvents — друзья пользователя, которые идут (или думают пойти) на
// опубликованные ивенты, ещё не закончившиеся. eventID > 0 — только этот ивент.
// Учитываем настройку «кто видит, куда я иду».
func (r *CabinetRepo) FriendsAtEvents(ctx context.Context, userID, eventID int64) ([]FriendAtEvent, error) {
    rows, err := r.db.Pool.Query(ctx, `
        WITH fr AS (
            SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS fid
            FROM friendships
            WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)
        )
        SELECT ea.event_id, ea.status, u.id, COALESCE(NULLIF(u.nickname, ''), u.full_name, ''), u.username,
               CASE WHEN u.avatar_visibility = 'private' THEN NULL ELSE u.avatar_url END
        FROM event_attendees ea
        JOIN fr ON fr.fid = ea.user_id
        JOIN users u ON u.id = ea.user_id
        JOIN offers o ON o.id = ea.event_id
        WHERE ea.status IN ('going', 'interested')
          AND o.is_event AND o.status = 'published'
          AND (o.end_at >= NOW() OR o.recurrence_rule IS NOT NULL)
          AND COALESCE(u.attending_events_visibility, 'public') IN ('public', 'friends', '')
          AND ($2 = 0 OR ea.event_id = $2)
        ORDER BY o.start_at, ea.status, u.full_name
        LIMIT 200`, userID, eventID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    out := []FriendAtEvent{}
    for rows.Next() {
        var f FriendAtEvent
        if err := rows.Scan(&f.EventID, &f.Status, &f.User.ID, &f.User.FullName, &f.User.Username, &f.User.AvatarURL); err != nil {
            return nil, err
        }
        out = append(out, f)
    }
    return out, rows.Err()
}

// ---------- Напоминания об ивентах ----------

type ReminderCandidate struct {
    EventID         int64
    UserID          int64
    Title           string
    Address         string
    StartAt         time.Time
    RecurrenceRule  string
    RecurrenceUntil *time.Time
}

// ReminderCandidates — участники (going) опубликованных ивентов, которые могут
// начаться в ближайшие часы: разовые с началом в окне и все повторяющиеся.
func (r *CabinetRepo) ReminderCandidates(ctx context.Context, from, to time.Time) ([]ReminderCandidate, error) {
    rows, err := r.db.Pool.Query(ctx, `
        SELECT o.id, ea.user_id, o.title, COALESCE(o.address, ''), o.start_at,
               COALESCE(o.recurrence_rule, ''), o.recurrence_until
        FROM event_attendees ea
        JOIN offers o ON o.id = ea.event_id
        WHERE ea.status = 'going' AND o.is_event AND o.status = 'published'
          AND ( (o.start_at >= $1 AND o.start_at < $2)
             OR (o.recurrence_rule IS NOT NULL AND o.start_at < $2
                 AND (o.recurrence_until IS NULL OR o.recurrence_until >= $1)) )`, from, to)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    out := []ReminderCandidate{}
    for rows.Next() {
        var c ReminderCandidate
        if err := rows.Scan(&c.EventID, &c.UserID, &c.Title, &c.Address, &c.StartAt, &c.RecurrenceRule, &c.RecurrenceUntil); err != nil {
            return nil, err
        }
        out = append(out, c)
    }
    return out, rows.Err()
}

// ReminderSent — уже напоминали об этом ивенте за последние 6 часов?
func (r *CabinetRepo) ReminderSent(ctx context.Context, userID, eventID int64) bool {
    var n int
    _ = r.db.Pool.QueryRow(ctx, `
        SELECT COUNT(*) FROM notifications
        WHERE user_id = $1 AND type = 'event_reminder' AND reference_id = $2
          AND created_at > NOW() - INTERVAL '6 hours'`, userID, eventID).Scan(&n)
    return n > 0
}

// ---------- Кошелёк студента: операции ----------

type WalletOperation struct {
    Kind      string    `json:"kind"` // topup, order, refund, bonus
    Title     string    `json:"title"`
    Method    string    `json:"method"`
    Amount    float64   `json:"amount"`
    Unit      string    `json:"unit"` // RUB, BONUS
    OrderID   *int64    `json:"order_id,omitempty"`
    CreatedAt time.Time `json:"created_at"`
}

// WalletOperations — деньги (проводки по счёту cash) и бонусы за период [from, to).
func (r *CabinetRepo) WalletOperations(ctx context.Context, userID int64, from, to time.Time) ([]WalletOperation, error) {
    out := []WalletOperation{}
    rows, err := r.db.Pool.Query(ctx, `
        SELECT lt.type, COALESCE(lt.description, ''), le.amount, le.created_at,
               o.id, COALESCE(c.name, ofr.title, ''), COALESCE(o.bonus_amount, 0),
               COALESCE(p.provider, '')
        FROM ledger_entries le
        JOIN accounts a ON a.id = le.account_id AND a.user_id = $1 AND a.type = 'cash'
        JOIN ledger_transactions lt ON lt.id = le.transaction_id
        LEFT JOIN orders o ON lt.reference_type = 'order' AND o.id = lt.reference_id
        LEFT JOIN offers ofr ON ofr.id = o.offer_id
        LEFT JOIN companies c ON c.id = o.company_id
        LEFT JOIN payments p ON lt.reference_type = 'payment' AND p.id = lt.reference_id
        WHERE le.created_at >= $2 AND le.created_at < $3
          AND COALESCE(lt.status, 'completed') <> 'failed'
          AND le.amount <> 0
        ORDER BY le.created_at DESC
        LIMIT 500`, userID, from, to)
    if err != nil {
        return nil, err
    }
    for rows.Next() {
        var typ, desc, place, provider string
        var amount, bonus float64
        var at time.Time
        var orderID *int64
        if err := rows.Scan(&typ, &desc, &amount, &at, &orderID, &place, &bonus, &provider); err != nil {
            rows.Close()
            return nil, err
        }
        op := WalletOperation{Amount: amount, Unit: "RUB", CreatedAt: at, OrderID: orderID}
        orderTitle := func(prefix string) string {
            t := prefix
            if orderID != nil {
                t += fmt.Sprintf(" № %06d", *orderID)
            }
            if place != "" {
                t += " · " + place
            }
            return t
        }
        switch typ {
        case "deposit":
            op.Kind, op.Title, op.Method = "topup", "Пополнение", "СБП"
            if provider != "" && provider != "sbp" && provider != "mock" {
                op.Method = "СБП · " + provider
            }
        case "purchase":
            op.Kind, op.Title, op.Method = "order", orderTitle("Заказ"), "Кошелёк"
            if bonus > 0 {
                op.Method = "Кошелёк + бонусы"
            }
        case "refund":
            op.Kind, op.Title, op.Method = "refund", orderTitle("Возврат"), "Кошелёк"
        default:
            op.Kind, op.Title, op.Method = "other", desc, "Кошелёк"
        }
        out = append(out, op)
    }
    rows.Close()

    brows, err := r.db.Pool.Query(ctx, `
        SELECT bt.type, bt.amount, bt.created_at, bt.reference_type, bt.reference_id,
               COALESCE(ru.username, ''), COALESCE(o.id, 0), COALESCE(c.name, '')
        FROM bonus_transactions bt
        LEFT JOIN referral_rewards rr ON bt.reference_type = 'referral_reward' AND rr.id = bt.reference_id
        LEFT JOIN users ru ON ru.id = CASE
             WHEN bt.reference_type = 'referral_reward' THEN rr.referred_user_id
             WHEN bt.reference_type = 'referral' THEN bt.reference_id END
        LEFT JOIN orders o ON bt.reference_type = 'order' AND o.id = bt.reference_id
        LEFT JOIN companies c ON c.id = o.company_id
        WHERE bt.user_id = $1 AND bt.created_at >= $2 AND bt.created_at < $3
        ORDER BY bt.created_at DESC
        LIMIT 500`, userID, from, to)
    if err != nil {
        return nil, err
    }
    defer brows.Close()
    for brows.Next() {
        var typ, refType, username, place string
        var amount float64
        var at time.Time
        var refID, orderID int64
        if err := brows.Scan(&typ, &amount, &at, &refType, &refID, &username, &orderID, &place); err != nil {
            return nil, err
        }
        op := WalletOperation{Kind: "bonus", Amount: amount, Unit: "BONUS", CreatedAt: at, Method: "Бонусы"}
        switch typ {
        case "referral_reward":
            op.Title = "Бонус за друга"
        case "referral_welcome":
            op.Title = "Бонус за приглашение"
        case "spend":
            op.Title = "Списано в заказе"
            if op.Amount > 0 {
                op.Amount = -op.Amount
            }
        case "refund":
            op.Title = "Возврат бонусов"
        case "achievement":
            op.Title = "Бонус за достижение"
        default:
            op.Title = "Бонусная операция"
        }
        if username != "" {
            op.Title += " · @" + username
        }
        if orderID > 0 {
            id := orderID
            op.OrderID = &id
            op.Title += fmt.Sprintf(" № %06d", orderID)
            if place != "" {
                op.Title += " · " + place
            }
        }
        out = append(out, op)
    }
    // Общая сортировка по времени, новые сверху.
    for i := 1; i < len(out); i++ {
        for j := i; j > 0 && out[j].CreatedAt.After(out[j-1].CreatedAt); j-- {
            out[j], out[j-1] = out[j-1], out[j]
        }
    }
    return out, brows.Err()
}

// WalletMonths — месяцы (YYYY-MM), в которых были операции, новые сверху.
func (r *CabinetRepo) WalletMonths(ctx context.Context, userID int64) ([]string, error) {
    rows, err := r.db.Pool.Query(ctx, `
        SELECT DISTINCT to_char(date_trunc('month', t AT TIME ZONE 'Europe/Moscow'), 'YYYY-MM') AS m FROM (
            SELECT le.created_at AS t FROM ledger_entries le
            JOIN accounts a ON a.id = le.account_id AND a.user_id = $1 AND a.type = 'cash'
            UNION ALL
            SELECT created_at FROM bonus_transactions WHERE user_id = $1
        ) x ORDER BY m DESC LIMIT 36`, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    out := []string{}
    for rows.Next() {
        var m string
        if err := rows.Scan(&m); err != nil {
            return nil, err
        }
        out = append(out, m)
    }
    return out, rows.Err()
}

// ---------- Рефералы: приглашённые ----------

type ReferralInvitee struct {
    UserID       int64      `json:"user_id"`
    FullName     string     `json:"full_name"`
    Username     *string    `json:"username,omitempty"`
    AvatarURL    *string    `json:"avatar_url,omitempty"`
    University   string     `json:"university,omitempty"`
    Verified     bool       `json:"verified"`
    JoinedAt     time.Time  `json:"joined_at"`
    RewardAmount float64    `json:"reward_amount"`
    RewardStatus string     `json:"reward_status,omitempty"` // pending, credited, cancelled
    AvailableAt  *time.Time `json:"available_at,omitempty"`
}

func (r *CabinetRepo) ReferralInvitees(ctx context.Context, userID int64) ([]ReferralInvitee, error) {
    rows, err := r.db.Pool.Query(ctx, `
        SELECT u.id, COALESCE(NULLIF(u.nickname, ''), u.full_name, ''), u.username,
               CASE WHEN u.avatar_visibility = 'private' THEN NULL ELSE u.avatar_url END,
               COALESCE(NULLIF(un.short_name, ''), un.name, ''),
               u.student_status = 'verified', COALESCE(ri.created_at, u.created_at),
               COALESCE(rr.amount, 0), COALESCE(rr.status, ''), rr.available_at
        FROM users u
        LEFT JOIN referral_invites ri ON ri.referrer_id = $1 AND ri.referred_user_id = u.id
        LEFT JOIN referral_rewards rr ON rr.referrer_id = $1 AND rr.referred_user_id = u.id
        LEFT JOIN universities un ON un.id = u.university_id
        WHERE u.referred_by = $1
        ORDER BY COALESCE(ri.created_at, u.created_at) DESC
        LIMIT 200`, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    out := []ReferralInvitee{}
    for rows.Next() {
        var v ReferralInvitee
        if err := rows.Scan(&v.UserID, &v.FullName, &v.Username, &v.AvatarURL, &v.University, &v.Verified,
            &v.JoinedAt, &v.RewardAmount, &v.RewardStatus, &v.AvailableAt); err != nil {
            return nil, err
        }
        out = append(out, v)
    }
    return out, rows.Err()
}

// UsernameTaken — занят ли username кем-то, кроме userID.
func (r *CabinetRepo) UsernameTaken(ctx context.Context, username string, userID int64) (bool, error) {
    var n int
    err := r.db.Pool.QueryRow(ctx,
        `SELECT COUNT(*) FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2`, username, userID).Scan(&n)
    return n > 0, err
}

// SetSearchable — «Показывать в поиске».
func (r *CabinetRepo) SetSearchable(ctx context.Context, userID int64, on bool) error {
    _, err := r.db.Pool.Exec(ctx, `UPDATE users SET searchable = $1, updated_at = NOW() WHERE id = $2`, on, userID)
    return err
}
