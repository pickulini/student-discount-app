package postgres

import (
    "context"
    "encoding/json"
    "regexp"
    "strconv"
    "strings"
    "time"

    "your-project/internal/journal"
)

// AdminRepo — выборки для админ-панели (макеты A01–A10): сводка, очереди,
// карточки и журнал действий. CRUD-операции остаются в своих репозиториях.
type AdminRepo struct {
    db *DB
}

func NewAdminRepo(db *DB) *AdminRepo { return &AdminRepo{db: db} }

// ---------- Журнал ----------

// WriteJournal — хранилище для пакета journal (строка в audit_logs).
func (r *AdminRepo) WriteJournal(ctx context.Context, e journal.Entry) error {
    meta, _ := json.Marshal(map[string]string{"text": e.Text})
    var actor interface{}
    if e.ActorID > 0 {
        actor = e.ActorID
    }
    var entity interface{}
    if e.EntityID > 0 {
        entity = e.EntityID
    }
    _, err := r.db.Pool.Exec(ctx,
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)`,
        actor, e.Action, e.EntityType, entity, meta)
    return err
}

type JournalItem struct {
    ID         int64     `json:"id"`
    At         time.Time `json:"at"`
    Action     string    `json:"action"`
    EntityType string    `json:"entity_type"`
    EntityID   *int64    `json:"entity_id,omitempty"`
    Text       string    `json:"text"`
    ActorID    *int64    `json:"actor_id,omitempty"`
    Actor      string    `json:"actor"` // «Е. Серова» или «Система»
    ActorRole  string    `json:"actor_role,omitempty"`
    ObjectName string    `json:"object_name,omitempty"` // @username / название предложения / компании
}

// ShortName: «Елена Серова» → «Е. Серова».
func ShortName(full string) string {
    parts := strings.Fields(full)
    if len(parts) < 2 {
        return strings.TrimSpace(full)
    }
    first := []rune(parts[0])
    return string(first[0]) + ". " + parts[len(parts)-1]
}

var genderRe = regexp.MustCompile(`\{([^{}|]*)\|([^{}|]*)\}`)

// genderize: «{Подтвердил|Подтвердила} верификацию» → форма по роду автора.
func genderize(text string, female bool) string {
    return genderRe.ReplaceAllStringFunc(text, func(m string) string {
        p := genderRe.FindStringSubmatch(m)
        if female {
            return p[2]
        }
        return p[1]
    })
}

// isFemaleName — по окончанию фамилии (Серова, Петрова, Ильина, Толстая).
func isFemaleName(full string) bool {
    parts := strings.Fields(strings.ToLower(full))
    if len(parts) == 0 {
        return false
    }
    last := parts[len(parts)-1]
    for _, suf := range []string{"ова", "ева", "ёва", "ина", "ына", "ая", "яя"} {
        if strings.HasSuffix(last, suf) {
            return true
        }
    }
    if len(parts) == 1 {
        return strings.HasSuffix(last, "а") || strings.HasSuffix(last, "я")
    }
    return false
}

// JournalFilter — фильтры журнала (A10).
type JournalFilter struct {
    Group   string // moderation | verification | refunds | roles | companies | system | ""
    ActorID int64  // 0 — все; -1 — только система
    Day     *time.Time
    Limit   int
    Offset  int
}

var journalGroups = map[string]string{
    "moderation":   `a.action LIKE 'offer.%'`,
    "verification": `a.action LIKE 'verify.%'`,
    "refunds":      `a.action = 'order.refund'`,
    "roles":        `a.action IN ('user.role','user.vip','user.block','user.university')`,
    "companies":    `(a.action LIKE 'company.%' OR a.action LIKE 'tag.%')`,
    "system":       `a.actor_id IS NULL`,
}

func (r *AdminRepo) Journal(ctx context.Context, f JournalFilter) ([]JournalItem, int, error) {
    where := []string{`a.entity_type <> 'admin_api'`}
    args := []interface{}{}
    if cond, ok := journalGroups[f.Group]; ok {
        where = append(where, cond)
    }
    if f.ActorID > 0 {
        args = append(args, f.ActorID)
        where = append(where, "a.actor_id = $"+itoa(len(args)))
    } else if f.ActorID < 0 {
        where = append(where, "a.actor_id IS NULL")
    }
    if f.Day != nil {
        args = append(args, *f.Day)
        where = append(where, "a.created_at >= $"+itoa(len(args))+" AND a.created_at < $"+itoa(len(args))+" + INTERVAL '1 day'")
    }
    w := strings.Join(where, " AND ")

    var total int
    if err := r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM audit_logs a WHERE `+w, args...).Scan(&total); err != nil {
        return nil, 0, err
    }
    if f.Limit <= 0 {
        f.Limit = 20
    }
    args = append(args, f.Limit, f.Offset)
    rows, err := r.db.Pool.Query(ctx, `
        SELECT a.id, a.created_at, a.action, a.entity_type, a.entity_id,
               COALESCE(a.metadata->>'text', ''), a.actor_id, COALESCE(u.full_name, ''), COALESCE(u.role, ''),
               COALESCE(CASE a.entity_type
                   WHEN 'user' THEN (SELECT '@' || ou.username FROM users ou WHERE ou.id = a.entity_id)
                   WHEN 'offer' THEN (SELECT oo.title FROM offers oo WHERE oo.id = a.entity_id)
                   WHEN 'company' THEN (SELECT oc.name FROM companies oc WHERE oc.id = a.entity_id)
               END, '')
        FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
        WHERE `+w+`
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $`+itoa(len(args)-1)+` OFFSET $`+itoa(len(args)), args...)
    if err != nil {
        return nil, 0, err
    }
    defer rows.Close()
    out := []JournalItem{}
    for rows.Next() {
        var it JournalItem
        var name string
        if err := rows.Scan(&it.ID, &it.At, &it.Action, &it.EntityType, &it.EntityID, &it.Text, &it.ActorID, &name, &it.ActorRole, &it.ObjectName); err != nil {
            return nil, 0, err
        }
        female := true // «Система» — женского рода
        if it.ActorID == nil {
            it.Actor = "Система"
        } else {
            it.Actor = ShortName(name)
            female = isFemaleName(name)
        }
        it.Text = genderize(it.Text, female)
        out = append(out, it)
    }
    return out, total, rows.Err()
}

// JournalActors — кто вообще встречается в журнале (для фильтра «КТО»).
func (r *AdminRepo) JournalActors(ctx context.Context) ([]map[string]interface{}, error) {
    rows, err := r.db.Pool.Query(ctx, `
        SELECT u.id, u.full_name, u.role, COUNT(*)
        FROM audit_logs a JOIN users u ON u.id = a.actor_id
        WHERE a.entity_type <> 'admin_api'
        GROUP BY u.id, u.full_name, u.role
        ORDER BY COUNT(*) DESC LIMIT 30`)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    out := []map[string]interface{}{}
    for rows.Next() {
        var id int64
        var name, role string
        var n int
        if err := rows.Scan(&id, &name, &role, &n); err != nil {
            return nil, err
        }
        out = append(out, map[string]interface{}{"id": id, "name": ShortName(name), "role": role, "count": n})
    }
    return out, rows.Err()
}

func itoa(n int) string { return strconv.Itoa(n) }

// ---------- Счётчики (меню, «LIVE») ----------

type AdminCounters struct {
    Moderation     int     `json:"moderation"`      // предложения + ивенты на модерации
    ModerationOffers int   `json:"moderation_offers"`
    ModerationEvents int   `json:"moderation_events"`
    Verifications  int     `json:"verifications"`   // заявки «ожидает»
    Support        int     `json:"support"`         // открытые обращения, где ждут ответа
    OrdersToday    int     `json:"orders_today"`
    RegsToday      int     `json:"registrations_today"`
    RevenueToday   float64 `json:"revenue_today"`
}

func (r *AdminRepo) Counters(ctx context.Context) (*AdminCounters, error) {
    c := &AdminCounters{}
    err := r.db.Pool.QueryRow(ctx, `
        SELECT
          (SELECT COUNT(*) FROM offers WHERE status = 'pending_review' AND NOT COALESCE(is_event, false)),
          (SELECT COUNT(*) FROM offers WHERE status = 'pending_review' AND COALESCE(is_event, false)),
          (SELECT COUNT(*) FROM student_verifications WHERE status = 'pending'),
          (SELECT COUNT(*) FROM support_tickets t
             WHERE t.status IN ('open', 'in_progress')
               AND COALESCE((SELECT m.user_id = t.user_id FROM support_messages m
                              WHERE m.ticket_id = t.id AND NOT m.is_note
                              ORDER BY m.created_at DESC, m.id DESC LIMIT 1), true)),
          (SELECT COUNT(*) FROM orders WHERE created_at >= date_trunc('day', NOW())),
          (SELECT COUNT(*) FROM users WHERE created_at >= date_trunc('day', NOW())),
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders
             WHERE created_at >= date_trunc('day', NOW()) AND status IN ('paid', 'completed'))
    `).Scan(&c.ModerationOffers, &c.ModerationEvents, &c.Verifications, &c.Support, &c.OrdersToday, &c.RegsToday, &c.RevenueToday)
    c.Moderation = c.ModerationOffers + c.ModerationEvents
    return c, err
}

// ---------- A01 · Сводка ----------

type AdminDashboard struct {
    Users            int       `json:"users"`
    UsersToday       int       `json:"users_today"`
    Companies        int       `json:"companies"`
    CompaniesWeek    int       `json:"companies_week"`
    Offers           int       `json:"offers"`
    OffersPublished  int       `json:"offers_published"`
    Orders           int       `json:"orders"`
    OrdersToday      int       `json:"orders_today"`
    Commission       float64   `json:"commission"`
    OldestOffer      *time.Time `json:"oldest_offer,omitempty"`
    OldestVerif      *time.Time `json:"oldest_verification,omitempty"`
    SupportLate      int       `json:"support_late"` // без ответа дольше 15 минут
    Days             []DayCount `json:"days"`
    MonthChange      *float64  `json:"month_change,omitempty"` // % к тем же дням прошлого месяца
    Recent           []JournalItem `json:"recent"`
    Counters         *AdminCounters `json:"counters"`
}

type DayCount struct {
    Day   string `json:"day"` // 2006-01-02
    Count int    `json:"count"`
}

func (r *AdminRepo) Dashboard(ctx context.Context, period string) (*AdminDashboard, error) {
    d := &AdminDashboard{}
    since := "date_trunc('day', NOW()) - INTERVAL '29 days'"
    switch period {
    case "today":
        since = "date_trunc('day', NOW())"
    case "all":
        since = "'-infinity'::timestamptz"
    }
    err := r.db.Pool.QueryRow(ctx, `
        SELECT
          (SELECT COUNT(*) FROM users WHERE is_active),
          (SELECT COUNT(*) FROM users WHERE is_active AND created_at >= date_trunc('day', NOW())),
          (SELECT COUNT(*) FROM companies),
          (SELECT COUNT(*) FROM companies WHERE created_at >= NOW() - INTERVAL '7 days'),
          (SELECT COUNT(*) FROM offers WHERE NOT COALESCE(is_event, false)),
          (SELECT COUNT(*) FROM offers WHERE NOT COALESCE(is_event, false) AND status = 'published'),
          (SELECT COUNT(*) FROM orders),
          (SELECT COUNT(*) FROM orders WHERE created_at >= date_trunc('day', NOW())),
          (SELECT COALESCE(SUM(commission), 0) FROM orders WHERE status IN ('paid', 'completed') AND created_at >= `+since+`),
          (SELECT MIN(updated_at) FROM offers WHERE status = 'pending_review'),
          (SELECT MIN(created_at) FROM student_verifications WHERE status = 'pending'),
          (SELECT COUNT(*) FROM support_tickets t
             WHERE t.status IN ('open', 'in_progress')
               AND (SELECT m.user_id = t.user_id AND m.created_at < NOW() - INTERVAL '15 minutes'
                      FROM support_messages m
                     WHERE m.ticket_id = t.id AND NOT m.is_note
                     ORDER BY m.created_at DESC, m.id DESC LIMIT 1))
    `).Scan(&d.Users, &d.UsersToday, &d.Companies, &d.CompaniesWeek, &d.Offers, &d.OffersPublished,
        &d.Orders, &d.OrdersToday, &d.Commission, &d.OldestOffer, &d.OldestVerif, &d.SupportLate)
    if err != nil {
        return nil, err
    }

    rows, err := r.db.Pool.Query(ctx, `
        SELECT to_char(g.day, 'YYYY-MM-DD'), COUNT(o.id)
        FROM generate_series(date_trunc('day', NOW()) - INTERVAL '29 days', date_trunc('day', NOW()), INTERVAL '1 day') AS g(day)
        LEFT JOIN orders o ON o.created_at >= g.day AND o.created_at < g.day + INTERVAL '1 day'
        GROUP BY g.day ORDER BY g.day`)
    if err != nil {
        return nil, err
    }
    for rows.Next() {
        var dc DayCount
        if err := rows.Scan(&dc.Day, &dc.Count); err != nil {
            rows.Close()
            return nil, err
        }
        d.Days = append(d.Days, dc)
    }
    rows.Close()

    // Месяц к месяцу: с 1-го числа по сегодня против тех же дней прошлого месяца.
    var cur, prev int
    if err := r.db.Pool.QueryRow(ctx, `
        SELECT
          (SELECT COUNT(*) FROM orders WHERE created_at >= date_trunc('month', NOW())),
          (SELECT COUNT(*) FROM orders WHERE created_at >= date_trunc('month', NOW()) - INTERVAL '1 month'
                                         AND created_at < NOW() - INTERVAL '1 month')`).Scan(&cur, &prev); err == nil && prev > 0 {
        ch := float64(cur-prev) / float64(prev) * 100
        d.MonthChange = &ch
    }

    d.Recent, _, err = r.Journal(ctx, JournalFilter{Limit: 5})
    if err != nil {
        return nil, err
    }
    d.Counters, err = r.Counters(ctx)
    return d, err
}

// ---------- A02 · Модерация ----------

type ModerationRow struct {
    ID            int64      `json:"id"`
    Title         string     `json:"title"`
    ImageURL      *string    `json:"image_url,omitempty"`
    BasePrice     float64    `json:"base_price"`
    SpecialPrice  *float64   `json:"special_price,omitempty"`
    DiscountType  string     `json:"discount_type"`
    DiscountValue float64    `json:"discount_value"`
    Company       string     `json:"company"`
    Status        string     `json:"status"`
    Expired       bool       `json:"expired"`
    SentAt        time.Time  `json:"sent_at"`
    IsEvent       bool       `json:"is_event"`
}

// Вкладки очереди модерации.
var moderationTabs = map[string]string{
    "pending":   `o.status = 'pending_review'`,
    "partner":   `o.status = 'pending_partner_approval'`,
    "published": `o.status = 'published' AND (o.end_at IS NULL OR o.end_at >= NOW())`,
    "rejected":  `o.status = 'rejected'`,
    "draft":     `o.status = 'draft'`,
    "expired":   `o.status = 'published' AND o.end_at < NOW()`,
    "archived":  `o.status = 'archived'`,
    "all":       `TRUE`,
}

func (r *AdminRepo) ModerationList(ctx context.Context, events bool, tab string) ([]ModerationRow, map[string]int, error) {
    cond, ok := moderationTabs[tab]
    if !ok {
        cond = moderationTabs["pending"]
    }
    order := "o.updated_at DESC"
    if tab == "pending" || tab == "partner" || tab == "" {
        order = "o.updated_at ASC" // сначала самые старые
    }
    rows, err := r.db.Pool.Query(ctx, `
        SELECT o.id, o.title, o.image_url, COALESCE(o.base_price, 0), o.special_price, o.discount_type,
               COALESCE(o.discount_value, 0), COALESCE(c.name, ''), o.status,
               (o.status = 'published' AND o.end_at < NOW()), o.updated_at, COALESCE(o.is_event, false)
        FROM offers o LEFT JOIN companies c ON c.id = o.company_id
        WHERE COALESCE(o.is_event, false) = $1 AND `+cond+`
        ORDER BY `+order+` LIMIT 300`, events)
    if err != nil {
        return nil, nil, err
    }
    defer rows.Close()
    out := []ModerationRow{}
    for rows.Next() {
        var m ModerationRow
        if err := rows.Scan(&m.ID, &m.Title, &m.ImageURL, &m.BasePrice, &m.SpecialPrice, &m.DiscountType,
            &m.DiscountValue, &m.Company, &m.Status, &m.Expired, &m.SentAt, &m.IsEvent); err != nil {
            return nil, nil, err
        }
        out = append(out, m)
    }
    rows.Close()

    counts := map[string]int{}
    var po, pe, pp int
    if err := r.db.Pool.QueryRow(ctx, `
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending_review' AND NOT COALESCE(is_event, false)),
          COUNT(*) FILTER (WHERE status = 'pending_review' AND COALESCE(is_event, false)),
          COUNT(*) FILTER (WHERE status = 'pending_partner_approval' AND COALESCE(is_event, false) = $1)
        FROM offers`, events).Scan(&po, &pe, &pp); err != nil {
        return nil, nil, err
    }
    counts["offers"], counts["events"], counts["partner"] = po, pe, pp
    if events {
        counts["pending"] = pe
    } else {
        counts["pending"] = po
    }
    return out, counts, nil
}

// ---------- A03 · Проверка предложения ----------

type ModerationPartner struct {
    ID          int64   `json:"id"`
    Name        string  `json:"name"`
    AvatarURL   *string `json:"avatar_url,omitempty"`
    Username    *string `json:"username,omitempty"`
    Companies   int     `json:"companies"`
    Offers      int     `json:"offers"`
    Rejected30d int     `json:"rejected_30d"`
}

type ModerationHistory struct {
    At   time.Time `json:"at"`
    Text string    `json:"text"`
}

type ModerationDetail struct {
    CompanyName    string              `json:"company_name"`
    CompanyID      *int64              `json:"company_id,omitempty"`
    Tags           []string            `json:"tags"`
    Partner        *ModerationPartner  `json:"partner,omitempty"`
    History        []ModerationHistory `json:"history"`
}

func (r *AdminRepo) ModerationDetail(ctx context.Context, offerID int64) (*ModerationDetail, error) {
    d := &ModerationDetail{Tags: []string{}, History: []ModerationHistory{}}
    var createdAt time.Time
    var organizer *int64
    if err := r.db.Pool.QueryRow(ctx, `
        SELECT o.company_id, COALESCE(c.name, ''), o.created_at, o.organizer_id
        FROM offers o LEFT JOIN companies c ON c.id = o.company_id WHERE o.id = $1`, offerID).
        Scan(&d.CompanyID, &d.CompanyName, &createdAt, &organizer); err != nil {
        return nil, err
    }
    if rows, err := r.db.Pool.Query(ctx, `SELECT t.name FROM offer_tags ot JOIN tags t ON t.id = ot.tag_id WHERE ot.offer_id = $1 ORDER BY t.name`, offerID); err == nil {
        for rows.Next() {
            var n string
            if rows.Scan(&n) == nil {
                d.Tags = append(d.Tags, n)
            }
        }
        rows.Close()
    }

    // Партнёр: владелец компании (или первый привязанный), для ивента пользователя — организатор.
    var partnerID *int64
    if d.CompanyID != nil {
        _ = r.db.Pool.QueryRow(ctx, `SELECT user_id FROM company_users WHERE company_id = $1
                                     ORDER BY (role = 'owner') DESC, id LIMIT 1`, *d.CompanyID).Scan(&partnerID)
    }
    if partnerID == nil {
        partnerID = organizer
    }
    if partnerID != nil {
        p := &ModerationPartner{ID: *partnerID}
        err := r.db.Pool.QueryRow(ctx, `
            SELECT u.full_name, u.avatar_url, u.username,
                   (SELECT COUNT(*) FROM company_users cu WHERE cu.user_id = u.id),
                   (SELECT COUNT(*) FROM offers o JOIN company_users cu ON cu.company_id = o.company_id WHERE cu.user_id = u.id),
                   (SELECT COUNT(*) FROM audit_logs a JOIN offers o ON o.id = a.entity_id
                                     JOIN company_users cu ON cu.company_id = o.company_id
                     WHERE a.action = 'offer.reject' AND a.entity_type = 'offer' AND cu.user_id = u.id
                       AND a.created_at >= NOW() - INTERVAL '30 days')
            FROM users u WHERE u.id = $1`, *partnerID).Scan(&p.Name, &p.AvatarURL, &p.Username, &p.Companies, &p.Offers, &p.Rejected30d)
        if err == nil {
            d.Partner = p
        }
    }

    rows, err := r.db.Pool.Query(ctx, `
        SELECT a.created_at, COALESCE(a.metadata->>'text', ''), COALESCE(u.full_name, ''), a.actor_id IS NULL
        FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
        WHERE a.entity_type = 'offer' AND a.entity_id = $1
        ORDER BY a.created_at DESC LIMIT 30`, offerID)
    if err != nil {
        return nil, err
    }
    for rows.Next() {
        var h ModerationHistory
        var name string
        var system bool
        if err := rows.Scan(&h.At, &h.Text, &name, &system); err != nil {
            rows.Close()
            return nil, err
        }
        h.Text = genderize(h.Text, system || isFemaleName(name))
        if !system && name != "" && !strings.HasPrefix(h.Text, "Партнёр") && !strings.Contains(h.Text, "отправлен") {
            h.Text = ShortName(name) + ": " + lowerFirst(h.Text)
        }
        d.History = append(d.History, h)
    }
    rows.Close()
    d.History = append(d.History, ModerationHistory{At: createdAt, Text: "Создан черновик"})
    return d, nil
}

func lowerFirst(s string) string {
    r := []rune(s)
    if len(r) == 0 {
        return s
    }
    return strings.ToLower(string(r[0])) + string(r[1:])
}

// ---------- A04 · Верификации ----------

type VerificationRow struct {
    ID          int64      `json:"id"`
    UserID      int64      `json:"user_id"`
    FullName    string     `json:"full_name"`
    Username    *string    `json:"username,omitempty"`
    AvatarURL   *string    `json:"avatar_url,omitempty"`
    Email       string     `json:"email"`
    University  string     `json:"university"`      // аббревиатура
    UniversityFull string  `json:"university_full"`
    DomainMatch bool       `json:"domain_match"`    // почта на домене вуза
    StudentID   string     `json:"student_identifier"`
    Status      string     `json:"status"`
    CreatedAt   time.Time  `json:"created_at"`
    ExpiresAt   *time.Time `json:"expires_at,omitempty"`
    Reason      string     `json:"rejection_reason,omitempty"`
    DocumentKey string     `json:"document_key,omitempty"`
    SelfieKey   string     `json:"selfie_key,omitempty"`
    UserCreated time.Time  `json:"user_created_at"`
    Attempt     int        `json:"attempt"`
}

var verificationTabs = map[string]string{
    "pending":  `v.status = 'pending'`,
    "verified": `v.status = 'verified'`,
    "rejected": `v.status = 'rejected'`,
    "expiring": `v.status = 'verified' AND v.expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'`,
    "all":      `TRUE`,
}

const verificationSelect = `
    SELECT v.id, v.user_id, u.full_name, u.username, u.avatar_url, u.email,
           COALESCE(NULLIF(un.short_name, ''), un.name, ''), COALESCE(un.name, ''),
           COALESCE(EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(un.domains, '[]'::jsonb)) d
                             WHERE lower(u.email) LIKE '%@' || lower(d) OR lower(u.email) LIKE '%.' || lower(d)), false),
           COALESCE(v.student_identifier, ''), v.status, v.created_at, v.expires_at, COALESCE(v.rejection_reason, ''),
           COALESCE(v.document_key, ''), COALESCE(v.selfie_key, ''), u.created_at,
           (SELECT COUNT(*) FROM student_verifications v2 WHERE v2.user_id = v.user_id AND v2.id <= v.id)
    FROM student_verifications v
    JOIN users u ON u.id = v.user_id
    LEFT JOIN universities un ON un.id = COALESCE(v.university_id, u.university_id)`

func scanVerification(row interface{ Scan(...interface{}) error }) (*VerificationRow, error) {
    var v VerificationRow
    err := row.Scan(&v.ID, &v.UserID, &v.FullName, &v.Username, &v.AvatarURL, &v.Email, &v.University, &v.UniversityFull,
        &v.DomainMatch, &v.StudentID, &v.Status, &v.CreatedAt, &v.ExpiresAt, &v.Reason, &v.DocumentKey, &v.SelfieKey,
        &v.UserCreated, &v.Attempt)
    return &v, err
}

func (r *AdminRepo) Verifications(ctx context.Context, tab string) ([]VerificationRow, map[string]interface{}, error) {
    cond, ok := verificationTabs[tab]
    if !ok {
        cond = verificationTabs["pending"]
    }
    order := "v.created_at DESC"
    if tab == "pending" || tab == "" {
        order = "v.created_at ASC"
    } else if tab == "expiring" {
        order = "v.expires_at ASC"
    }
    rows, err := r.db.Pool.Query(ctx, verificationSelect+` WHERE `+cond+` ORDER BY `+order+` LIMIT 300`)
    if err != nil {
        return nil, nil, err
    }
    defer rows.Close()
    out := []VerificationRow{}
    for rows.Next() {
        v, err := scanVerification(rows)
        if err != nil {
            return nil, nil, err
        }
        // Документы в списке не нужны.
        v.DocumentKey, v.SelfieKey = "", ""
        out = append(out, *v)
    }
    rows.Close()
    var pending, expiring int
    var avg *float64
    err = r.db.Pool.QueryRow(ctx, `
        SELECT COUNT(*) FILTER (WHERE status = 'pending'),
               COUNT(*) FILTER (WHERE status = 'verified' AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'),
               AVG(EXTRACT(EPOCH FROM (verified_at - created_at))) FILTER (WHERE verified_at IS NOT NULL AND verified_at > NOW() - INTERVAL '30 days')
        FROM student_verifications`).Scan(&pending, &expiring, &avg)
    meta := map[string]interface{}{"pending": pending, "expiring": expiring}
    if avg != nil {
        meta["avg_seconds"] = *avg
    }
    return out, meta, err
}

func (r *AdminRepo) Verification(ctx context.Context, id int64) (*VerificationRow, error) {
    return scanVerification(r.db.Pool.QueryRow(ctx, verificationSelect+` WHERE v.id = $1`, id))
}

// ---------- A06 · Пользователи ----------

type AdminUserRow struct {
    ID          int64      `json:"id"`
    FullName    string     `json:"full_name"`
    Username    *string    `json:"username,omitempty"`
    AvatarURL   *string    `json:"avatar_url,omitempty"`
    Email       string     `json:"email"`
    University  string     `json:"university"`
    DomainMatch bool       `json:"domain_match"`
    Student     string     `json:"student"` // verified | pending | expired | none
    StudentUntil *time.Time `json:"student_until,omitempty"`
    Balance     *float64   `json:"balance,omitempty"`
    Role        string     `json:"role"`
    IsVIP       bool       `json:"is_vip"`
    IsActive    bool       `json:"is_active"`
    CreatedAt   time.Time  `json:"created_at"`
    ReferralCode string    `json:"referral_code"`
}

// Статус студента по последней заявке: подтверждён / ожидает / истёк / нет.
const studentStatusSQL = `
    COALESCE((SELECT CASE
                WHEN sv.status = 'verified' AND (sv.expires_at IS NULL OR sv.expires_at > NOW()) THEN 'verified'
                WHEN sv.status = 'verified' THEN 'expired'
                WHEN sv.status = 'pending' THEN 'pending'
                ELSE 'none' END
              FROM student_verifications sv WHERE sv.user_id = u.id
              ORDER BY sv.created_at DESC, sv.id DESC LIMIT 1), 'none')`

var userFilters = map[string]string{
    "all":        `TRUE`,
    "students":   `u.role = 'student'`,
    "unverified": `u.role = 'student' AND ` + studentStatusSQL + ` <> 'verified'`,
    "partners":   `u.role = 'merchant'`,
    "admins":     `u.role = 'admin'`,
    "vip":        `COALESCE(u.is_vip, false)`,
    "blocked":    `NOT u.is_active`,
}

const adminUserSelect = `
    SELECT u.id, u.full_name, u.username, u.avatar_url, u.email,
           COALESCE(NULLIF(un.short_name, ''), un.name, ''),
           COALESCE(EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(un.domains, '[]'::jsonb)) d
                             WHERE lower(u.email) LIKE '%@' || lower(d) OR lower(u.email) LIKE '%.' || lower(d)), false),
           ` + studentStatusSQL + `,
           (SELECT sv.expires_at FROM student_verifications sv WHERE sv.user_id = u.id AND sv.status = 'verified'
             ORDER BY sv.verified_at DESC NULLS LAST, sv.id DESC LIMIT 1),
           (SELECT a.balance FROM accounts a WHERE a.user_id = u.id AND a.type = 'cash' LIMIT 1),
           u.role, COALESCE(u.is_vip, false), u.is_active, u.created_at, u.referral_code
    FROM users u LEFT JOIN universities un ON un.id = u.university_id`

func scanAdminUser(row interface{ Scan(...interface{}) error }) (*AdminUserRow, error) {
    var u AdminUserRow
    err := row.Scan(&u.ID, &u.FullName, &u.Username, &u.AvatarURL, &u.Email, &u.University, &u.DomainMatch,
        &u.Student, &u.StudentUntil, &u.Balance, &u.Role, &u.IsVIP, &u.IsActive, &u.CreatedAt, &u.ReferralCode)
    return &u, err
}

func (r *AdminRepo) Users(ctx context.Context, filter, q string, limit, offset int) ([]AdminUserRow, int, map[string]int, error) {
    where := []string{`u.email NOT LIKE 'deleted+%@deleted.invalid'`}
    if cond, ok := userFilters[filter]; ok {
        where = append(where, cond)
    }
    args := []interface{}{}
    q = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(q), "@"))
    if q != "" {
        if id, err := strconv.ParseInt(q, 10, 64); err == nil {
            args = append(args, id)
            where = append(where, "u.id = $"+itoa(len(args)))
        } else {
            args = append(args, "%"+q+"%")
            n := itoa(len(args))
            where = append(where, "(u.full_name ILIKE $"+n+" OR u.email ILIKE $"+n+" OR u.username ILIKE $"+n+" OR u.nickname ILIKE $"+n+")")
        }
    }
    w := strings.Join(where, " AND ")
    var total int
    if err := r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users u WHERE `+w, args...).Scan(&total); err != nil {
        return nil, 0, nil, err
    }
    args = append(args, limit, offset)
    rows, err := r.db.Pool.Query(ctx, adminUserSelect+` WHERE `+w+` ORDER BY u.created_at DESC, u.id DESC LIMIT $`+itoa(len(args)-1)+` OFFSET $`+itoa(len(args)), args...)
    if err != nil {
        return nil, 0, nil, err
    }
    defer rows.Close()
    out := []AdminUserRow{}
    for rows.Next() {
        u, err := scanAdminUser(rows)
        if err != nil {
            return nil, 0, nil, err
        }
        out = append(out, *u)
    }
    rows.Close()

    counts := map[string]int{}
    for k, cond := range userFilters {
        var n int
        if err := r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users u WHERE u.email NOT LIKE 'deleted+%@deleted.invalid' AND `+cond).Scan(&n); err != nil {
            return nil, 0, nil, err
        }
        counts[k] = n
    }
    return out, total, counts, nil
}

// ---------- A07 · Пользователь ----------

type AdminUserOrder struct {
    ID        int64     `json:"id"`
    CreatedAt time.Time `json:"created_at"`
    Company   string    `json:"company"`
    Title     string    `json:"title"`
    Total     float64   `json:"total"`
    Status    string    `json:"status"`
    Redeemed  bool      `json:"redeemed"`
}

type AdminUserCard struct {
    User        *AdminUserRow    `json:"user"`
    Orders      int              `json:"orders"`
    ToppedUp    float64          `json:"topped_up"`
    Spent       float64          `json:"spent"`
    Refunds     float64          `json:"refunds"`
    Bonuses     float64          `json:"bonuses"`
    RecentOrders []AdminUserOrder `json:"recent_orders"`
    Companies   []map[string]interface{} `json:"companies"`
}

func (r *AdminRepo) UserCard(ctx context.Context, id int64) (*AdminUserCard, error) {
    u, err := scanAdminUser(r.db.Pool.QueryRow(ctx, adminUserSelect+` WHERE u.id = $1`, id))
    if err != nil {
        return nil, err
    }
    c := &AdminUserCard{User: u, RecentOrders: []AdminUserOrder{}, Companies: []map[string]interface{}{}}
    err = r.db.Pool.QueryRow(ctx, `
        SELECT
          (SELECT COUNT(*) FROM orders WHERE user_id = $1),
          (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE user_id = $1 AND status IN ('completed', 'succeeded', 'paid')),
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE user_id = $1 AND status IN ('paid', 'completed')),
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE user_id = $1 AND status = 'refunded'),
          (SELECT COALESCE(balance, 0) FROM bonus_accounts WHERE user_id = $1 LIMIT 1)`, id).
        Scan(&c.Orders, &c.ToppedUp, &c.Spent, &c.Refunds, &c.Bonuses)
    if err != nil {
        // bonus_accounts может не быть — пробуем без него
        c.Bonuses = 0
    }
    rows, err := r.db.Pool.Query(ctx, `
        SELECT o.id, o.created_at, COALESCE(co.name, ''), COALESCE(ofr.title, ''), o.total_amount, o.status, o.redeemed_at IS NOT NULL
        FROM orders o LEFT JOIN companies co ON co.id = o.company_id LEFT JOIN offers ofr ON ofr.id = o.offer_id
        WHERE o.user_id = $1 ORDER BY o.created_at DESC LIMIT 8`, id)
    if err != nil {
        return nil, err
    }
    for rows.Next() {
        var o AdminUserOrder
        if err := rows.Scan(&o.ID, &o.CreatedAt, &o.Company, &o.Title, &o.Total, &o.Status, &o.Redeemed); err != nil {
            rows.Close()
            return nil, err
        }
        c.RecentOrders = append(c.RecentOrders, o)
    }
    rows.Close()
    if rows, err := r.db.Pool.Query(ctx, `SELECT c.id, c.name FROM company_users cu JOIN companies c ON c.id = cu.company_id WHERE cu.user_id = $1 ORDER BY c.name`, id); err == nil {
        for rows.Next() {
            var cid int64
            var name string
            if rows.Scan(&cid, &name) == nil {
                c.Companies = append(c.Companies, map[string]interface{}{"id": cid, "name": name})
            }
        }
        rows.Close()
    }
    return c, nil
}

// SetVIP / SetActive / ResetVerification — действия из карточки пользователя.
func (r *AdminRepo) SetVIP(ctx context.Context, id int64, on bool) error {
    _, err := r.db.Pool.Exec(ctx, `UPDATE users SET is_vip = $1, updated_at = NOW() WHERE id = $2`, on, id)
    return err
}

func (r *AdminRepo) SetActive(ctx context.Context, id int64, on bool) error {
    _, err := r.db.Pool.Exec(ctx, `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`, on, id)
    if err == nil && !on {
        _, err = r.db.Pool.Exec(ctx, `UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, id)
    }
    return err
}

// ResetVerification — статус студента снимается, человек проходит проверку заново.
func (r *AdminRepo) ResetVerification(ctx context.Context, id int64) error {
    _, err := r.db.Pool.Exec(ctx, `
        UPDATE student_verifications SET expires_at = NOW(), updated_at = NOW()
        WHERE user_id = $1 AND status = 'verified' AND (expires_at IS NULL OR expires_at > NOW())`, id)
    if err == nil {
        _, err = r.db.Pool.Exec(ctx, `UPDATE users SET student_status = 'pending', updated_at = NOW() WHERE id = $1`, id)
    }
    return err
}

// Universities — справочник для «Сменить вуз».
func (r *AdminRepo) Universities(ctx context.Context) ([]map[string]interface{}, error) {
    rows, err := r.db.Pool.Query(ctx, `SELECT id, name, COALESCE(short_name, '') FROM universities WHERE is_active ORDER BY name`)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    out := []map[string]interface{}{}
    for rows.Next() {
        var id int64
        var name, short string
        if err := rows.Scan(&id, &name, &short); err != nil {
            return nil, err
        }
        out = append(out, map[string]interface{}{"id": id, "name": name, "short_name": short})
    }
    return out, rows.Err()
}

// ---------- A08 · Компании и теги ----------

type AdminCompanyRow struct {
    ID        int64     `json:"id"`
    Name      string    `json:"name"`
    Kind      string    `json:"kind"`
    Cover     *string   `json:"cover,omitempty"`
    Locations int       `json:"locations"`
    IsNew     bool      `json:"is_new"`
    OwnerID   *int64    `json:"owner_id,omitempty"`
    Owner     string    `json:"owner"`
    Offers    int       `json:"offers"`
    Balance   float64   `json:"balance"`
    IsActive  bool      `json:"is_active"`
    CreatedAt time.Time `json:"created_at"`
}

func (r *AdminRepo) Companies(ctx context.Context, q string) ([]AdminCompanyRow, map[string]int, error) {
    args := []interface{}{}
    where := "TRUE"
    if q = strings.TrimSpace(q); q != "" {
        args = append(args, "%"+q+"%")
        where = `(c.name ILIKE $1 OR EXISTS (SELECT 1 FROM company_users cu JOIN users u ON u.id = cu.user_id
                                              WHERE cu.company_id = c.id AND (u.full_name ILIKE $1 OR u.email ILIKE $1)))`
    }
    rows, err := r.db.Pool.Query(ctx, `
        SELECT c.id, c.name, COALESCE(cat.name, split_part(COALESCE(c.description, ''), '.', 1), ''),
               COALESCE(c.logo_key, (SELECT o.image_url FROM offers o WHERE o.company_id = c.id AND o.image_url IS NOT NULL AND o.image_url <> ''
                                      ORDER BY (o.status = 'published') DESC, o.updated_at DESC LIMIT 1)),
               (SELECT COUNT(*) FROM company_locations l WHERE l.company_id = c.id),
               c.created_at > NOW() - INTERVAL '7 days',
               ow.id, COALESCE(ow.full_name, ''),
               (SELECT COUNT(*) FROM offers o WHERE o.company_id = c.id AND NOT COALESCE(o.is_event, false)),
               COALESCE((SELECT ma.balance FROM merchant_accounts ma WHERE ma.company_id = c.id LIMIT 1), 0),
               c.is_active, c.created_at
        FROM companies c
        LEFT JOIN categories cat ON cat.id = c.category_id
        LEFT JOIN LATERAL (SELECT u.id, u.full_name FROM company_users cu JOIN users u ON u.id = cu.user_id
                           WHERE cu.company_id = c.id ORDER BY (cu.role = 'owner') DESC, cu.id LIMIT 1) ow ON TRUE
        WHERE `+where+`
        ORDER BY c.is_active DESC, c.name LIMIT 500`, args...)
    if err != nil {
        return nil, nil, err
    }
    defer rows.Close()
    out := []AdminCompanyRow{}
    for rows.Next() {
        var c AdminCompanyRow
        var owner string
        if err := rows.Scan(&c.ID, &c.Name, &c.Kind, &c.Cover, &c.Locations, &c.IsNew, &c.OwnerID, &owner, &c.Offers, &c.Balance, &c.IsActive, &c.CreatedAt); err != nil {
            return nil, nil, err
        }
        c.Owner = ShortName(owner)
        out = append(out, c)
    }
    rows.Close()
    var total, week int
    err = r.db.Pool.QueryRow(ctx, `SELECT COUNT(*), COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') FROM companies`).Scan(&total, &week)
    return out, map[string]int{"total": total, "week": week}, err
}

func (r *AdminRepo) SetCompanyActive(ctx context.Context, id int64, on bool) (string, error) {
    var name string
    err := r.db.Pool.QueryRow(ctx, `UPDATE companies SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING name`, on, id).Scan(&name)
    return name, err
}

// CreateCompany — компания с владельцем: владелец становится партнёром.
func (r *AdminRepo) CreateCompany(ctx context.Context, name, description string, ownerID *int64) (int64, error) {
    tx, err := r.db.Pool.Begin(ctx)
    if err != nil {
        return 0, err
    }
    defer tx.Rollback(ctx)
    var id int64
    if err := tx.QueryRow(ctx, `INSERT INTO companies (name, description, is_active) VALUES ($1, $2, true) RETURNING id`, name, description).Scan(&id); err != nil {
        return 0, err
    }
    if _, err := tx.Exec(ctx, `INSERT INTO merchant_accounts (company_id, balance, currency) VALUES ($1, 0, 'RUB')`, id); err != nil {
        return 0, err
    }
    if ownerID != nil {
        if _, err := tx.Exec(ctx, `INSERT INTO company_users (user_id, company_id, role) VALUES ($1, $2, 'owner')`, *ownerID, id); err != nil {
            return 0, err
        }
        if _, err := tx.Exec(ctx, `UPDATE users SET role = 'merchant', updated_at = NOW() WHERE id = $1 AND role = 'student'`, *ownerID); err != nil {
            return 0, err
        }
    }
    return id, tx.Commit(ctx)
}

// FindUser — по email, @username или ID (для поля «Владелец»).
func (r *AdminRepo) FindUser(ctx context.Context, q string) (int64, string, error) {
    q = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(q), "@"))
    var id int64
    var name string
    err := r.db.Pool.QueryRow(ctx, `
        SELECT id, full_name FROM users
        WHERE is_active AND (lower(email) = lower($1) OR lower(username) = lower($1) OR id::text = $1)
        LIMIT 1`, q).Scan(&id, &name)
    return id, name, err
}

type AdminTag struct {
    ID      int64  `json:"id"`
    Name    string `json:"name"`
    Status  string `json:"status"`
    Offers  int    `json:"offers"`
    Source  string `json:"source,omitempty"` // для предложенных: компания автора
}

func (r *AdminRepo) Tags(ctx context.Context) ([]AdminTag, error) {
    rows, err := r.db.Pool.Query(ctx, `
        SELECT t.id, t.name, t.status,
               (SELECT COUNT(*) FROM offer_tags ot JOIN offers o ON o.id = ot.offer_id WHERE ot.tag_id = t.id AND o.status = 'published'),
               COALESCE((SELECT c.name FROM offer_tags ot JOIN offers o ON o.id = ot.offer_id JOIN companies c ON c.id = o.company_id
                          WHERE ot.tag_id = t.id ORDER BY o.id LIMIT 1),
                        (SELECT c.name FROM company_users cu JOIN companies c ON c.id = cu.company_id WHERE cu.user_id = t.created_by LIMIT 1),
                        (SELECT u.full_name FROM users u WHERE u.id = t.created_by), '')
        FROM tags t
        ORDER BY (t.status = 'pending') DESC, 4 DESC, t.name`)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    out := []AdminTag{}
    for rows.Next() {
        var t AdminTag
        if err := rows.Scan(&t.ID, &t.Name, &t.Status, &t.Offers, &t.Source); err != nil {
            return nil, err
        }
        out = append(out, t)
    }
    return out, rows.Err()
}

func (r *AdminRepo) ApproveTag(ctx context.Context, id int64) (string, error) {
    var name string
    err := r.db.Pool.QueryRow(ctx, `UPDATE tags SET status = 'active' WHERE id = $1 RETURNING name`, id).Scan(&name)
    return name, err
}

// RejectTag — предложенный тег удаляется и снимается с предложений.
func (r *AdminRepo) RejectTag(ctx context.Context, id int64) (string, error) {
    var name string
    if err := r.db.Pool.QueryRow(ctx, `SELECT name FROM tags WHERE id = $1 AND status = 'pending'`, id).Scan(&name); err != nil {
        return "", err
    }
    if _, err := r.db.Pool.Exec(ctx, `DELETE FROM offer_tags WHERE tag_id = $1`, id); err != nil {
        return "", err
    }
    _, err := r.db.Pool.Exec(ctx, `DELETE FROM tags WHERE id = $1`, id)
    return name, err
}

func (r *AdminRepo) CreateTag(ctx context.Context, name, slug string, by int64) (int64, error) {
    var id int64
    err := r.db.Pool.QueryRow(ctx, `
        INSERT INTO tags (name, slug, status, created_by) VALUES ($1, $2, 'active', $3)
        ON CONFLICT (slug) DO UPDATE SET status = 'active'
        RETURNING id`, name, slug, by).Scan(&id)
    return id, err
}

// ---------- A09 · Поддержка ----------

type AdminTicket struct {
    ID          int64      `json:"id"`
    Subject     string     `json:"subject"`
    Status      string     `json:"status"`
    CreatedAt   time.Time  `json:"created_at"`
    UserID      int64      `json:"user_id"`
    Username    *string    `json:"username,omitempty"`
    FullName    string     `json:"full_name"`
    Waiting     bool       `json:"waiting"`      // последнее слово за пользователем
    LastAt      *time.Time `json:"last_at,omitempty"`
}

var ticketTabs = map[string]string{
    "open":        `t.status = 'open'`,
    "in_progress": `t.status = 'in_progress'`,
    "resolved":    `t.status IN ('resolved', 'closed')`,
    "all":         `TRUE`,
}

const ticketSelect = `
    SELECT t.id, t.subject, t.status, t.created_at, u.id, u.username, u.full_name,
           COALESCE(lm.user_id = t.user_id, true), lm.created_at
    FROM support_tickets t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN LATERAL (SELECT m.user_id, m.created_at FROM support_messages m
                       WHERE m.ticket_id = t.id AND NOT m.is_note
                       ORDER BY m.created_at DESC, m.id DESC LIMIT 1) lm ON TRUE`

func scanTicket(row interface{ Scan(...interface{}) error }) (*AdminTicket, error) {
    var t AdminTicket
    err := row.Scan(&t.ID, &t.Subject, &t.Status, &t.CreatedAt, &t.UserID, &t.Username, &t.FullName, &t.Waiting, &t.LastAt)
    return &t, err
}

func (r *AdminRepo) Tickets(ctx context.Context, tab string) ([]AdminTicket, map[string]int, error) {
    cond, ok := ticketTabs[tab]
    if !ok {
        cond = ticketTabs["open"]
    }
    rows, err := r.db.Pool.Query(ctx, ticketSelect+` WHERE `+cond+`
        ORDER BY COALESCE(lm.user_id = t.user_id, true) DESC, COALESCE(lm.created_at, t.created_at) ASC LIMIT 200`)
    if err != nil {
        return nil, nil, err
    }
    defer rows.Close()
    out := []AdminTicket{}
    for rows.Next() {
        t, err := scanTicket(rows)
        if err != nil {
            return nil, nil, err
        }
        if t.Status == "resolved" || t.Status == "closed" {
            t.Waiting = false
        }
        out = append(out, *t)
    }
    rows.Close()
    counts := map[string]int{}
    var o, p int
    err = r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FILTER (WHERE status = 'open'), COUNT(*) FILTER (WHERE status = 'in_progress') FROM support_tickets`).Scan(&o, &p)
    counts["open"], counts["in_progress"] = o, p
    return out, counts, err
}

type AdminTicketMessage struct {
    ID        int64     `json:"id"`
    Message   string    `json:"message"`
    CreatedAt time.Time `json:"created_at"`
    AuthorID  int64     `json:"author_id"`
    Author    string    `json:"author"`
    FromUser  bool      `json:"from_user"`
    IsNote    bool      `json:"is_note"`
}

type AdminTicketDetail struct {
    Ticket   *AdminTicket         `json:"ticket"`
    User     *AdminUserRow        `json:"user"`
    Orders   int                  `json:"orders"`
    Referral map[string]interface{} `json:"referral,omitempty"`
    Messages []AdminTicketMessage `json:"messages"`
}

func (r *AdminRepo) Ticket(ctx context.Context, id int64) (*AdminTicketDetail, error) {
    t, err := scanTicket(r.db.Pool.QueryRow(ctx, ticketSelect+` WHERE t.id = $1`, id))
    if err != nil {
        return nil, err
    }
    d := &AdminTicketDetail{Ticket: t, Messages: []AdminTicketMessage{}}
    if u, err := scanAdminUser(r.db.Pool.QueryRow(ctx, adminUserSelect+` WHERE u.id = $1`, t.UserID)); err == nil {
        d.User = u
    }
    _ = r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE user_id = $1`, t.UserID).Scan(&d.Orders)
    var refName *string
    var refAt *time.Time
    if err := r.db.Pool.QueryRow(ctx, `
        SELECT u.username, (SELECT sv.verified_at FROM student_verifications sv WHERE sv.user_id = u.id AND sv.status = 'verified'
                            ORDER BY sv.verified_at DESC NULLS LAST LIMIT 1)
        FROM users u WHERE u.referred_by = $1 ORDER BY u.created_at DESC LIMIT 1`, t.UserID).Scan(&refName, &refAt); err == nil && refName != nil {
        d.Referral = map[string]interface{}{"username": *refName, "verified_at": refAt}
    }
    rows, err := r.db.Pool.Query(ctx, `
        SELECT m.id, m.message, m.created_at, m.user_id, COALESCE(u.full_name, ''), m.user_id = $2, m.is_note
        FROM support_messages m LEFT JOIN users u ON u.id = m.user_id
        WHERE m.ticket_id = $1 ORDER BY m.created_at, m.id`, id, t.UserID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    for rows.Next() {
        var m AdminTicketMessage
        var name string
        if err := rows.Scan(&m.ID, &m.Message, &m.CreatedAt, &m.AuthorID, &name, &m.FromUser, &m.IsNote); err != nil {
            return nil, err
        }
        m.Author = ShortName(name)
        d.Messages = append(d.Messages, m)
    }
    return d, rows.Err()
}

// AddNote — служебная заметка: видна только поддержке.
func (r *AdminRepo) AddNote(ctx context.Context, ticketID, adminID int64, text string) error {
    _, err := r.db.Pool.Exec(ctx, `INSERT INTO support_messages (ticket_id, user_id, message, is_internal, is_note) VALUES ($1, $2, $3, true, true)`, ticketID, adminID, text)
    return err
}
