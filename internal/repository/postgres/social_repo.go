package postgres

import (
    "context"
    "fmt"
    "strings"
    "time"
)

// ---------- Соцсети: друзья, профиль, подписки (экраны D51–D53) ----------
//
// Видимость полей считается так же, как в остальном API:
//   public — всем, friends — только друзьям, private — только самому себе.

type SocialPerson struct {
    ID         int64   `json:"id"`
    FullName   string  `json:"full_name"`
    Username   *string `json:"username,omitempty"`
    AvatarURL  *string `json:"avatar_url,omitempty"`
    University string  `json:"university,omitempty"`
    Mutual     int     `json:"mutual,omitempty"`
    Activity   string  `json:"activity,omitempty"`
    RequestID  int64   `json:"request_id,omitempty"`
    Since      *time.Time `json:"since,omitempty"`
}

// friendIDs — id всех друзей пользователя.
func (r *CabinetRepo) friendIDs(ctx context.Context, userID int64) ([]int64, error) {
    rows, err := r.db.Pool.Query(ctx, `
        SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END
        FROM friendships
        WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)`, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    out := []int64{}
    for rows.Next() {
        var id int64
        if err := rows.Scan(&id); err != nil {
            return nil, err
        }
        out = append(out, id)
    }
    return out, rows.Err()
}

// people — карточки людей глазами viewer (аватар и вуз с учётом приватности).
// friendsOfViewer — множество друзей viewer, чтобы понять уровень «friends».
func (r *CabinetRepo) people(ctx context.Context, viewerID int64, ids []int64, friendsOfViewer map[int64]bool) (map[int64]*SocialPerson, error) {
    out := map[int64]*SocialPerson{}
    if len(ids) == 0 {
        return out, nil
    }
    rows, err := r.db.Pool.Query(ctx, `
        SELECT u.id, COALESCE(NULLIF(u.nickname, ''), u.full_name, ''), u.username, u.avatar_url,
               COALESCE(NULLIF(un.short_name, ''), un.name, ''), u.avatar_visibility, u.university_visibility
        FROM users u
        LEFT JOIN universities un ON un.id = u.university_id
        WHERE u.id = ANY($1)`, ids)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    for rows.Next() {
        p := &SocialPerson{}
        var avVis, uniVis string
        if err := rows.Scan(&p.ID, &p.FullName, &p.Username, &p.AvatarURL, &p.University, &avVis, &uniVis); err != nil {
            return nil, err
        }
        isFriend := friendsOfViewer[p.ID]
        self := p.ID == viewerID
        if !visibleTo(avVis, isFriend, self) {
            p.AvatarURL = nil
        }
        if !visibleTo(uniVis, isFriend, self) {
            p.University = ""
        }
        out[p.ID] = p
    }
    return out, rows.Err()
}

func visibleTo(vis string, isFriend, self bool) bool {
    switch vis {
    case "", "public":
        return true
    case "friends":
        return isFriend || self
    default:
        return self
    }
}

// mutualCounts — сколько общих друзей у viewer с каждым из ids.
func (r *CabinetRepo) mutualCounts(ctx context.Context, viewerID int64, ids []int64) (map[int64]int, error) {
    out := map[int64]int{}
    if len(ids) == 0 {
        return out, nil
    }
    rows, err := r.db.Pool.Query(ctx, `
        WITH mine AS (
            SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS fid
            FROM friendships WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)
        ), theirs AS (
            SELECT CASE WHEN f.requester_id = t.id THEN f.addressee_id ELSE f.requester_id END AS fid, t.id AS owner
            FROM unnest($2::bigint[]) AS t(id)
            JOIN friendships f ON f.status = 'accepted' AND (f.requester_id = t.id OR f.addressee_id = t.id)
        )
        SELECT theirs.owner, COUNT(*) FROM theirs JOIN mine ON mine.fid = theirs.fid GROUP BY theirs.owner`, viewerID, ids)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    for rows.Next() {
        var id int64
        var n int
        if err := rows.Scan(&id, &n); err != nil {
            return nil, err
        }
        out[id] = n
    }
    return out, rows.Err()
}

var weekdayAcc = []string{"в воскресенье", "в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу"}
var monthPrep = []string{"январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"}

func nextStart(start time.Time, rule string, now time.Time) time.Time {
    t := start
    for i := 0; i < 1000 && t.Before(now) && rule != ""; i++ {
        switch {
        case strings.Contains(rule, "FREQ=DAILY"):
            t = t.AddDate(0, 0, 1)
        case strings.Contains(rule, "FREQ=WEEKLY"):
            t = t.AddDate(0, 0, 7)
        case strings.Contains(rule, "FREQ=MONTHLY"):
            t = t.AddDate(0, 1, 0)
        default:
            return t
        }
    }
    return t
}

// activities — одна строка «что нового» у каждого друга:
// ближайший ивент → свежая подписка → экономия за месяц.
func (r *CabinetRepo) activities(ctx context.Context, ids []int64) (map[int64]string, error) {
    out := map[int64]string{}
    if len(ids) == 0 {
        return out, nil
    }
    msk := time.FixedZone("MSK", 3*3600)
    now := time.Now().In(msk)

    rows, err := r.db.Pool.Query(ctx, `
        SELECT ea.user_id, o.title, o.start_at, COALESCE(o.recurrence_rule, '')
        FROM event_attendees ea
        JOIN offers o ON o.id = ea.event_id
        JOIN users u ON u.id = ea.user_id
        WHERE ea.user_id = ANY($1) AND ea.status = 'going'
          AND o.is_event AND o.status = 'published' AND o.event_privacy = 'public'
          AND (o.end_at >= NOW() OR o.recurrence_rule IS NOT NULL)
          AND u.attending_events_visibility <> 'private'
        ORDER BY o.start_at`, ids)
    if err != nil {
        return nil, err
    }
    best := map[int64]time.Time{}
    for rows.Next() {
        var uid int64
        var title, rule string
        var start time.Time
        if err := rows.Scan(&uid, &title, &start, &rule); err != nil {
            rows.Close()
            return nil, err
        }
        at := nextStart(start, rule, now).In(msk)
        if at.Before(now) {
            continue
        }
        if prev, ok := best[uid]; ok && !at.Before(prev) {
            continue
        }
        best[uid] = at
        when := weekdayAcc[at.Weekday()]
        if at.YearDay() == now.YearDay() && at.Year() == now.Year() {
            when = "сегодня"
        } else if at.Sub(now) > 7*24*time.Hour {
            when = at.Format("02.01")
        }
        out[uid] = fmt.Sprintf("Идёт на «%s» %s", title, when)
    }
    rows.Close()

    rows, err = r.db.Pool.Query(ctx, `
        SELECT DISTINCT ON (cs.user_id) cs.user_id, c.name
        FROM company_subscriptions cs
        JOIN companies c ON c.id = cs.company_id
        JOIN users u ON u.id = cs.user_id
        WHERE cs.user_id = ANY($1) AND cs.created_at > NOW() - INTERVAL '30 days'
          AND u.subscriptions_visibility <> 'private'
        ORDER BY cs.user_id, cs.created_at DESC`, ids)
    if err != nil {
        return nil, err
    }
    for rows.Next() {
        var uid int64
        var name string
        if err := rows.Scan(&uid, &name); err != nil {
            rows.Close()
            return nil, err
        }
        if _, ok := out[uid]; !ok {
            out[uid] = "Подписка: " + name
        }
    }
    rows.Close()

    from := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, msk)
    rows, err = r.db.Pool.Query(ctx, `
        SELECT o.user_id, SUM(o.subtotal - o.total_amount)
        FROM orders o JOIN users u ON u.id = o.user_id
        WHERE o.user_id = ANY($1) AND o.status IN ('paid', 'completed') AND o.created_at >= $2
          AND u.statistics_visibility <> 'private'
        GROUP BY o.user_id HAVING SUM(o.subtotal - o.total_amount) > 0`, ids, from)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    for rows.Next() {
        var uid int64
        var saved float64
        if err := rows.Scan(&uid, &saved); err != nil {
            return nil, err
        }
        if _, ok := out[uid]; !ok {
            out[uid] = fmt.Sprintf("Сэкономлено %s ₽ в %s", groupThousands(int64(saved+0.5)), monthPrep[now.Month()-1])
        }
    }
    return out, rows.Err()
}

func groupThousands(v int64) string {
    s := fmt.Sprintf("%d", v)
    var b strings.Builder
    for i, c := range s {
        if i > 0 && (len(s)-i)%3 == 0 {
            b.WriteRune(' ')
        }
        b.WriteRune(c)
    }
    return b.String()
}

type FriendsOverview struct {
    Friends     []SocialPerson `json:"friends"`
    Incoming    []SocialPerson `json:"incoming"`
    Outgoing    []SocialPerson `json:"outgoing"`
    Suggestions []SocialPerson `json:"suggestions"`
}

func (r *CabinetRepo) FriendsOverview(ctx context.Context, userID int64) (*FriendsOverview, error) {
    res := &FriendsOverview{Friends: []SocialPerson{}, Incoming: []SocialPerson{}, Outgoing: []SocialPerson{}, Suggestions: []SocialPerson{}}
    fids, err := r.friendIDs(ctx, userID)
    if err != nil {
        return nil, err
    }
    isFriend := map[int64]bool{}
    for _, id := range fids {
        isFriend[id] = true
    }

    // Заявки: входящие и исходящие.
    type req struct {
        id, other int64
        at        time.Time
        incoming  bool
    }
    reqs := []req{}
    rows, err := r.db.Pool.Query(ctx, `
        SELECT id, requester_id, addressee_id, created_at FROM friendships
        WHERE status = 'pending' AND (requester_id = $1 OR addressee_id = $1)
        ORDER BY created_at DESC`, userID)
    if err != nil {
        return nil, err
    }
    for rows.Next() {
        var id, from, to int64
        var at time.Time
        if err := rows.Scan(&id, &from, &to, &at); err != nil {
            rows.Close()
            return nil, err
        }
        if to == userID {
            reqs = append(reqs, req{id, from, at, true})
        } else {
            reqs = append(reqs, req{id, to, at, false})
        }
    }
    rows.Close()

    // Возможно, знакомы: друзья друзей, затем — студенты того же вуза.
    pending := map[int64]bool{}
    for _, q := range reqs {
        pending[q.other] = true
    }
    sugg := []int64{}
    rows, err = r.db.Pool.Query(ctx, `
        WITH mine AS (
            SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS fid
            FROM friendships WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)
        )
        SELECT CASE WHEN f.requester_id = mine.fid THEN f.addressee_id ELSE f.requester_id END AS cand, COUNT(*) AS n
        FROM mine
        JOIN friendships f ON f.status = 'accepted' AND (f.requester_id = mine.fid OR f.addressee_id = mine.fid)
        GROUP BY cand
        ORDER BY n DESC
        LIMIT 40`, userID)
    if err != nil {
        return nil, err
    }
    for rows.Next() {
        var id int64
        var n int
        if err := rows.Scan(&id, &n); err != nil {
            rows.Close()
            return nil, err
        }
        if id != userID && !isFriend[id] && !pending[id] {
            sugg = append(sugg, id)
        }
    }
    rows.Close()
    if len(sugg) < 4 {
        rows, err = r.db.Pool.Query(ctx, `
            SELECT u.id FROM users u
            WHERE u.university_id = (SELECT university_id FROM users WHERE id = $1)
              AND u.university_id IS NOT NULL AND u.id <> $1 AND u.is_active
              AND u.role = 'student'
            ORDER BY u.created_at DESC LIMIT 20`, userID)
        if err != nil {
            return nil, err
        }
        seen := map[int64]bool{}
        for _, id := range sugg {
            seen[id] = true
        }
        for rows.Next() {
            var id int64
            if err := rows.Scan(&id); err != nil {
                rows.Close()
                return nil, err
            }
            if !seen[id] && !isFriend[id] && !pending[id] && len(sugg) < 6 {
                sugg = append(sugg, id)
                seen[id] = true
            }
        }
        rows.Close()
    }
    if len(sugg) > 6 {
        sugg = sugg[:6]
    }

    all := append([]int64{}, fids...)
    for _, q := range reqs {
        all = append(all, q.other)
    }
    all = append(all, sugg...)
    ppl, err := r.people(ctx, userID, all, isFriend)
    if err != nil {
        return nil, err
    }
    nonFriends := []int64{}
    for _, q := range reqs {
        nonFriends = append(nonFriends, q.other)
    }
    nonFriends = append(nonFriends, sugg...)
    nonFriends = append(nonFriends, fids...)
    mutual, err := r.mutualCounts(ctx, userID, nonFriends)
    if err != nil {
        return nil, err
    }
    acts, err := r.activities(ctx, fids)
    if err != nil {
        return nil, err
    }

    for _, id := range fids {
        if p, ok := ppl[id]; ok {
            c := *p
            c.Activity = acts[id]
            c.Mutual = mutual[id]
            res.Friends = append(res.Friends, c)
        }
    }
    for _, q := range reqs {
        if p, ok := ppl[q.other]; ok {
            c := *p
            c.RequestID = q.id
            c.Mutual = mutual[q.other]
            at := q.at
            c.Since = &at
            if q.incoming {
                res.Incoming = append(res.Incoming, c)
            } else {
                res.Outgoing = append(res.Outgoing, c)
            }
        }
    }
    for _, id := range sugg {
        if p, ok := ppl[id]; ok {
            c := *p
            c.Mutual = mutual[id]
            res.Suggestions = append(res.Suggestions, c)
        }
    }
    return res, nil
}

type ProfileSub struct {
    ID    int64   `json:"id"`
    Name  string  `json:"name"`
    Cover *string `json:"cover,omitempty"`
}

type ProfileExtras struct {
    UserID             int64          `json:"user_id"`
    AvatarURL          *string        `json:"avatar_url,omitempty"`
    University         string         `json:"university,omitempty"`
    FriendsCount       *int           `json:"friends_count,omitempty"`
    MutualCount        int            `json:"mutual_count"`
    Mutual             []SocialPerson `json:"mutual"`
    SubscriptionsCount *int           `json:"subscriptions_count,omitempty"`
    Subscriptions      []ProfileSub   `json:"subscriptions"`
    SavedTotal         *float64       `json:"saved_total,omitempty"`
    SavedHidden        bool           `json:"saved_hidden"`
    IsFriend           bool           `json:"is_friend"`
    IsSelf             bool           `json:"is_self"`
}

// ProfileExtras — данные для публичного профиля (D51) глазами viewerID (0 — гость).
func (r *CabinetRepo) ProfileExtras(ctx context.Context, username string, viewerID int64) (*ProfileExtras, error) {
    var id int64
    var avatar *string
    var uni, avVis, uniVis, flVis, subVis, statVis string
    err := r.db.Pool.QueryRow(ctx, `
        SELECT u.id, u.avatar_url, COALESCE(NULLIF(un.short_name, ''), un.name, ''),
               u.avatar_visibility, u.university_visibility, u.friends_list_visibility,
               u.subscriptions_visibility, u.statistics_visibility
        FROM users u LEFT JOIN universities un ON un.id = u.university_id
        WHERE LOWER(u.username) = LOWER($1)`, username).Scan(&id, &avatar, &uni, &avVis, &uniVis, &flVis, &subVis, &statVis)
    if err != nil {
        return nil, err
    }
    res := &ProfileExtras{UserID: id, Mutual: []SocialPerson{}, Subscriptions: []ProfileSub{}, IsSelf: viewerID == id}

    viewerFriends := map[int64]bool{}
    if viewerID > 0 {
        vf, err := r.friendIDs(ctx, viewerID)
        if err != nil {
            return nil, err
        }
        for _, f := range vf {
            viewerFriends[f] = true
        }
    }
    res.IsFriend = viewerFriends[id]
    see := func(vis string) bool { return visibleTo(vis, res.IsFriend, res.IsSelf) }

    if see(avVis) {
        res.AvatarURL = avatar
    }
    if see(uniVis) {
        res.University = uni
    }
    theirFriends, err := r.friendIDs(ctx, id)
    if err != nil {
        return nil, err
    }
    if see(flVis) {
        n := len(theirFriends)
        res.FriendsCount = &n
    }
    if viewerID > 0 && viewerID != id {
        mutualIDs := []int64{}
        for _, f := range theirFriends {
            if viewerFriends[f] {
                mutualIDs = append(mutualIDs, f)
            }
        }
        res.MutualCount = len(mutualIDs)
        if len(mutualIDs) > 8 {
            mutualIDs = mutualIDs[:8]
        }
        ppl, err := r.people(ctx, viewerID, mutualIDs, viewerFriends)
        if err != nil {
            return nil, err
        }
        for _, m := range mutualIDs {
            if p, ok := ppl[m]; ok {
                res.Mutual = append(res.Mutual, *p)
            }
        }
    }
    if see(subVis) {
        rows, err := r.db.Pool.Query(ctx, `
            SELECT c.id, c.name,
                   (SELECT o.image_url FROM offers o WHERE o.company_id = c.id AND o.image_url IS NOT NULL AND o.image_url <> ''
                    ORDER BY (o.status = 'published') DESC, o.created_at DESC LIMIT 1)
            FROM company_subscriptions cs JOIN companies c ON c.id = cs.company_id
            WHERE cs.user_id = $1 ORDER BY cs.created_at DESC`, id)
        if err != nil {
            return nil, err
        }
        for rows.Next() {
            var s ProfileSub
            if err := rows.Scan(&s.ID, &s.Name, &s.Cover); err != nil {
                rows.Close()
                return nil, err
            }
            res.Subscriptions = append(res.Subscriptions, s)
        }
        rows.Close()
        n := len(res.Subscriptions)
        res.SubscriptionsCount = &n
    }
    if see(statVis) {
        var saved float64
        _ = r.db.Pool.QueryRow(ctx, `
            SELECT COALESCE(SUM(subtotal - total_amount), 0) FROM orders
            WHERE user_id = $1 AND status IN ('paid', 'completed')`, id).Scan(&saved)
        res.SavedTotal = &saved
    } else {
        res.SavedHidden = true
    }
    return res, nil
}

type SubscriptionCard struct {
    ID           int64   `json:"id"`
    Name         string  `json:"name"`
    Description  string  `json:"description,omitempty"`
    Category     string  `json:"category,omitempty"`
    Cover        *string `json:"cover,omitempty"`
    Locations    int     `json:"locations"`
    Offers       int     `json:"offers"`
    Events       int     `json:"events"`
    BestPercent  float64 `json:"best_percent"`
    BestFixed    float64 `json:"best_fixed"`
    SubscribedAt time.Time `json:"subscribed_at"`
}

// SubscriptionsOverview — карточки мест, на которые подписан пользователь (D53).
func (r *CabinetRepo) SubscriptionsOverview(ctx context.Context, userID int64) ([]SubscriptionCard, error) {
    rows, err := r.db.Pool.Query(ctx, `
        SELECT c.id, c.name, COALESCE(c.description, ''),
               COALESCE((SELECT t.name FROM offers o JOIN offer_tags ot ON ot.offer_id = o.id JOIN tags t ON t.id = ot.tag_id
                         WHERE o.company_id = c.id GROUP BY t.name ORDER BY COUNT(*) DESC, t.name LIMIT 1), ''),
               (SELECT o.image_url FROM offers o WHERE o.company_id = c.id AND o.image_url IS NOT NULL AND o.image_url <> ''
                ORDER BY (o.status = 'published') DESC, o.created_at DESC LIMIT 1),
               (SELECT COUNT(*) FROM company_locations l WHERE l.company_id = c.id),
               (SELECT COUNT(*) FROM offers o WHERE o.company_id = c.id AND NOT o.is_event AND o.status = 'published'
                  AND o.start_at <= NOW() AND o.end_at >= NOW()),
               (SELECT COUNT(*) FROM offers o WHERE o.company_id = c.id AND o.is_event AND o.status = 'published'
                  AND (o.end_at >= NOW() OR o.recurrence_rule IS NOT NULL)),
               COALESCE((SELECT MAX(o.discount_value) FROM offers o WHERE o.company_id = c.id AND NOT o.is_event
                  AND o.status = 'published' AND o.end_at >= NOW() AND o.discount_type = 'percentage'), 0),
               COALESCE((SELECT MAX(o.discount_value) FROM offers o WHERE o.company_id = c.id AND NOT o.is_event
                  AND o.status = 'published' AND o.end_at >= NOW() AND o.discount_type <> 'percentage'), 0),
               cs.created_at
        FROM company_subscriptions cs
        JOIN companies c ON c.id = cs.company_id
        WHERE cs.user_id = $1
        ORDER BY cs.created_at DESC`, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    out := []SubscriptionCard{}
    for rows.Next() {
        var s SubscriptionCard
        if err := rows.Scan(&s.ID, &s.Name, &s.Description, &s.Category, &s.Cover, &s.Locations, &s.Offers, &s.Events,
            &s.BestPercent, &s.BestFixed, &s.SubscribedAt); err != nil {
            return nil, err
        }
        out = append(out, s)
    }
    return out, rows.Err()
}

// ---------- Поддержка: список обращений и переписка (D55) ----------

type SupportTicketRow struct {
    ID            int64      `json:"id"`
    Subject       string     `json:"subject"`
    Status        string     `json:"status"`
    CreatedAt     time.Time  `json:"created_at"`
    UpdatedAt     time.Time  `json:"updated_at"`
    ClosedAt      *time.Time `json:"closed_at,omitempty"`
    LastMessageAt *time.Time `json:"last_message_at,omitempty"`
    LastFromStaff bool       `json:"last_from_staff"`
    Messages      int        `json:"messages"`
}

func (r *CabinetRepo) SupportTickets(ctx context.Context, userID int64) ([]SupportTicketRow, error) {
    rows, err := r.db.Pool.Query(ctx, `
        SELECT t.id, t.subject, t.status, t.created_at, t.updated_at, t.closed_at,
               lm.created_at, COALESCE(lm.user_id <> t.user_id, false),
               (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id AND NOT m.is_note)
        FROM support_tickets t
        LEFT JOIN LATERAL (
            SELECT m.created_at, m.user_id FROM support_messages m
            WHERE m.ticket_id = t.id AND NOT m.is_note ORDER BY m.created_at DESC, m.id DESC LIMIT 1
        ) lm ON true
        WHERE t.user_id = $1
        ORDER BY (t.status IN ('open', 'in_progress')) DESC, COALESCE(lm.created_at, t.updated_at) DESC`, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    out := []SupportTicketRow{}
    for rows.Next() {
        var t SupportTicketRow
        if err := rows.Scan(&t.ID, &t.Subject, &t.Status, &t.CreatedAt, &t.UpdatedAt, &t.ClosedAt,
            &t.LastMessageAt, &t.LastFromStaff, &t.Messages); err != nil {
            return nil, err
        }
        out = append(out, t)
    }
    return out, rows.Err()
}

type SupportThreadMessage struct {
    ID         int64     `json:"id"`
    Message    string    `json:"message"`
    CreatedAt  time.Time `json:"created_at"`
    Mine       bool      `json:"mine"`
    AuthorName string    `json:"author_name"`
}

// SupportThread — переписка по обращению владельца (nil, если чужое).
func (r *CabinetRepo) SupportThread(ctx context.Context, ticketID, userID int64) ([]SupportThreadMessage, error) {
    var owner int64
    if err := r.db.Pool.QueryRow(ctx, `SELECT user_id FROM support_tickets WHERE id = $1`, ticketID).Scan(&owner); err != nil || owner != userID {
        return nil, fmt.Errorf("ticket not found")
    }
    rows, err := r.db.Pool.Query(ctx, `
        SELECT m.id, m.message, m.created_at, m.user_id = $2,
               split_part(COALESCE(NULLIF(u.nickname, ''), u.full_name, ''), ' ', 1)
        FROM support_messages m
        LEFT JOIN users u ON u.id = m.user_id
        WHERE m.ticket_id = $1 AND NOT m.is_note
        ORDER BY m.created_at, m.id`, ticketID, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    out := []SupportThreadMessage{}
    for rows.Next() {
        var m SupportThreadMessage
        if err := rows.Scan(&m.ID, &m.Message, &m.CreatedAt, &m.Mine, &m.AuthorName); err != nil {
            return nil, err
        }
        out = append(out, m)
    }
    return out, rows.Err()
}

// CloseSupportTicket — студент сам закрывает своё обращение.
func (r *CabinetRepo) CloseSupportTicket(ctx context.Context, ticketID, userID int64) error {
    tag, err := r.db.Pool.Exec(ctx, `
        UPDATE support_tickets SET status = 'closed', closed_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND status <> 'closed'`, ticketID, userID)
    if err != nil {
        return err
    }
    if tag.RowsAffected() == 0 {
        return fmt.Errorf("ticket not found")
    }
    return nil
}
