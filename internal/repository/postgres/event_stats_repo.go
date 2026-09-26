package postgres

import (
	"context"
	"errors"
	"time"
)

// Статистика ивентов для организатора — любого пользователя, не только партнёра.

type OrganizerEventStat struct {
	ID              int64      `json:"id"`
	Title           string     `json:"title"`
	Status          string     `json:"status"`
	StartAt         *time.Time `json:"start_at,omitempty"`
	EndAt           *time.Time `json:"end_at,omitempty"`
	ImageURL        *string    `json:"image_url,omitempty"`
	Price           float64    `json:"price"`
	RejectionReason *string    `json:"rejection_reason,omitempty"`
	Going           int        `json:"going"`
	Interested      int        `json:"interested"`
	Viewers         int        `json:"viewers"`
	Going7d         int        `json:"going_7d"`
	Tickets         int        `json:"tickets"`
	Revenue         float64    `json:"revenue"`
}

const organizerEventStatSQL = `
	SELECT o.id, o.title, o.status, o.start_at, o.end_at, o.image_url, COALESCE(o.base_price, 0), o.rejection_reason,
	       (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = o.id AND ea.status = 'going' AND ea.user_id IS DISTINCT FROM o.organizer_id),
	       (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = o.id AND ea.status = 'interested' AND ea.user_id IS DISTINCT FROM o.organizer_id),
	       (SELECT COUNT(DISTINCT v.user_id) FROM event_views v WHERE v.event_id = o.id),
	       (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = o.id AND ea.status = 'going'
	                                          AND ea.user_id IS DISTINCT FROM o.organizer_id
	                                          AND ea.updated_at >= NOW() - INTERVAL '7 days'),
	       (SELECT COUNT(*) FROM orders od WHERE od.offer_id = o.id AND od.status IN ('paid', 'completed')),
	       (SELECT COALESCE(SUM(od.total_amount), 0) FROM orders od WHERE od.offer_id = o.id AND od.status IN ('paid', 'completed'))
	FROM offers o
	WHERE o.is_event = true AND o.organizer_id = $1`

func scanOrganizerStat(row interface{ Scan(...any) error }) (OrganizerEventStat, error) {
	var s OrganizerEventStat
	err := row.Scan(&s.ID, &s.Title, &s.Status, &s.StartAt, &s.EndAt, &s.ImageURL, &s.Price, &s.RejectionReason,
		&s.Going, &s.Interested, &s.Viewers, &s.Going7d, &s.Tickets, &s.Revenue)
	return s, err
}

// OrganizerEventStats — все ивенты пользователя с цифрами, свежие сверху.
func (r *CabinetRepo) OrganizerEventStats(ctx context.Context, userID int64) ([]OrganizerEventStat, error) {
	rows, err := r.db.Pool.Query(ctx, organizerEventStatSQL+` ORDER BY o.start_at DESC NULLS LAST, o.id DESC LIMIT 200`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []OrganizerEventStat{}
	for rows.Next() {
		s, err := scanOrganizerStat(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

var ErrNotOrganizer = errors.New("event not found")

type EventStatDay struct {
	Day     string `json:"day"` // YYYY-MM-DD
	Viewers int    `json:"viewers"`
	Going   int    `json:"going"`
}

type EventStatAttendee struct {
	ID         int64     `json:"id"`
	FullName   string    `json:"full_name"`
	Nickname   *string   `json:"nickname,omitempty"`
	Username   *string   `json:"username,omitempty"`
	AvatarURL  *string   `json:"avatar_url,omitempty"`
	University *string   `json:"university,omitempty"`
	Status     string    `json:"status"`
	At         time.Time `json:"at"`
	Paid       bool      `json:"paid"`
}

type EventStatDetail struct {
	OrganizerEventStat
	Days      []EventStatDay      `json:"days"`
	Attendees []EventStatAttendee `json:"attendees"`
}

// OrganizerEventStat — подробности по одному ивенту: динамика за 14 дней и кто идёт.
// Только для организатора; чужой ивент — ErrNotOrganizer.
func (r *CabinetRepo) OrganizerEventStat(ctx context.Context, userID, eventID int64) (*EventStatDetail, error) {
	s, err := scanOrganizerStat(r.db.Pool.QueryRow(ctx, organizerEventStatSQL+` AND o.id = $2`, userID, eventID))
	if err != nil {
		return nil, ErrNotOrganizer
	}
	d := &EventStatDetail{OrganizerEventStat: s, Days: []EventStatDay{}, Attendees: []EventStatAttendee{}}

	rows, err := r.db.Pool.Query(ctx, `
		SELECT to_char(g.day, 'YYYY-MM-DD'),
		       (SELECT COUNT(*) FROM event_views v WHERE v.event_id = $1 AND v.viewed_on = g.day),
		       (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = $1 AND ea.status = 'going'
		                                          AND ea.user_id IS DISTINCT FROM $2
		                                          AND ea.updated_at::date = g.day)
		FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, INTERVAL '1 day') AS g(day)
		ORDER BY g.day`, eventID, userID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var day EventStatDay
		if err := rows.Scan(&day.Day, &day.Viewers, &day.Going); err != nil {
			rows.Close()
			return nil, err
		}
		d.Days = append(d.Days, day)
	}
	rows.Close()

	rows, err = r.db.Pool.Query(ctx, `
		SELECT u.id, u.full_name, u.nickname, u.username, u.avatar_url, un.short_name, ea.status, ea.updated_at,
		       EXISTS (SELECT 1 FROM orders od WHERE od.offer_id = $1 AND od.user_id = u.id AND od.status IN ('paid', 'completed'))
		FROM event_attendees ea
		JOIN users u ON u.id = ea.user_id
		LEFT JOIN universities un ON un.id = u.university_id
		WHERE ea.event_id = $1 AND ea.status IN ('going', 'interested') AND u.is_active = true
		  AND ea.user_id <> $2 -- сам организатор в списке гостей не нужен
		ORDER BY (ea.status = 'going') DESC, ea.updated_at DESC
		LIMIT 300`, eventID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var a EventStatAttendee
		if err := rows.Scan(&a.ID, &a.FullName, &a.Nickname, &a.Username, &a.AvatarURL, &a.University, &a.Status, &a.At, &a.Paid); err != nil {
			return nil, err
		}
		d.Attendees = append(d.Attendees, a)
	}
	return d, rows.Err()
}

// TrackEventView — отметка «пользователь открыл страницу ивента» (раз в день; свои не считаем).
func (r *CabinetRepo) TrackEventView(ctx context.Context, eventID, userID int64) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO event_views (event_id, user_id)
		SELECT $1, $2 FROM offers
		WHERE id = $1 AND is_event = true AND organizer_id IS DISTINCT FROM $2
		ON CONFLICT DO NOTHING`, eventID, userID)
	return err
}
