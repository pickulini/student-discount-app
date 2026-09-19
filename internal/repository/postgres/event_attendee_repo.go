package postgres

import (
    "context"

    "your-project/internal/domain"
    "your-project/internal/repository"
)

type EventAttendeeRepo struct {
    db *DB
}

func NewEventAttendeeRepo(db *DB) repository.EventAttendeeRepository {
    return &EventAttendeeRepo{db: db}
}

func (r *EventAttendeeRepo) Upsert(ctx context.Context, a *domain.EventAttendee) error {
    query := `INSERT INTO event_attendees (event_id, user_id, status, order_id)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (event_id, user_id) DO UPDATE
              SET status = EXCLUDED.status, order_id = EXCLUDED.order_id, updated_at = NOW()
              RETURNING id, created_at, updated_at`
    return r.db.Pool.QueryRow(ctx, query,
        a.EventID, a.UserID, a.Status, a.OrderID,
    ).Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
}

func (r *EventAttendeeRepo) GetByEventAndUser(ctx context.Context, eventID, userID int64) (*domain.EventAttendee, error) {
    query := `SELECT id, event_id, user_id, status, order_id, created_at, updated_at
              FROM event_attendees WHERE event_id = $1 AND user_id = $2`
    var a domain.EventAttendee
    err := r.db.Pool.QueryRow(ctx, query, eventID, userID).Scan(
        &a.ID, &a.EventID, &a.UserID, &a.Status, &a.OrderID, &a.CreatedAt, &a.UpdatedAt,
    )
    if err != nil {
        return nil, err
    }
    return &a, nil
}

func (r *EventAttendeeRepo) Delete(ctx context.Context, eventID, userID int64) error {
    _, err := r.db.Pool.Exec(ctx,
        `DELETE FROM event_attendees WHERE event_id = $1 AND user_id = $2`,
        eventID, userID)
    return err
}

func (r *EventAttendeeRepo) ListByEvent(ctx context.Context, eventID int64, status string) ([]domain.EventAttendee, error) {
    var query string
    var args []interface{}
    if status != "" {
        query = `SELECT id, event_id, user_id, status, order_id, created_at, updated_at
                 FROM event_attendees WHERE event_id = $1 AND status = $2 ORDER BY created_at`
        args = []interface{}{eventID, status}
    } else {
        query = `SELECT id, event_id, user_id, status, order_id, created_at, updated_at
                 FROM event_attendees WHERE event_id = $1 ORDER BY created_at`
        args = []interface{}{eventID}
    }
    rows, err := r.db.Pool.Query(ctx, query, args...)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    result := make([]domain.EventAttendee, 0)
    for rows.Next() {
        var a domain.EventAttendee
        if err := rows.Scan(&a.ID, &a.EventID, &a.UserID, &a.Status, &a.OrderID, &a.CreatedAt, &a.UpdatedAt); err != nil {
            return nil, err
        }
        result = append(result, a)
    }
    return result, rows.Err()
}

func (r *EventAttendeeRepo) ListByUser(ctx context.Context, userID int64, status string) ([]domain.EventAttendee, error) {
    var query string
    var args []interface{}
    if status != "" {
        query = `SELECT id, event_id, user_id, status, order_id, created_at, updated_at
                 FROM event_attendees WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC`
        args = []interface{}{userID, status}
    } else {
        query = `SELECT id, event_id, user_id, status, order_id, created_at, updated_at
                 FROM event_attendees WHERE user_id = $1 ORDER BY created_at DESC`
        args = []interface{}{userID}
    }
    rows, err := r.db.Pool.Query(ctx, query, args...)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    result := make([]domain.EventAttendee, 0)
    for rows.Next() {
        var a domain.EventAttendee
        if err := rows.Scan(&a.ID, &a.EventID, &a.UserID, &a.Status, &a.OrderID, &a.CreatedAt, &a.UpdatedAt); err != nil {
            return nil, err
        }
        result = append(result, a)
    }
    return result, rows.Err()
}

func (r *EventAttendeeRepo) CountByEvent(ctx context.Context, eventID int64, status string) (int, error) {
    var count int
    var err error
    if status != "" {
        err = r.db.Pool.QueryRow(ctx,
            `SELECT COUNT(*) FROM event_attendees WHERE event_id = $1 AND status = $2`,
            eventID, status).Scan(&count)
    } else {
        err = r.db.Pool.QueryRow(ctx,
            `SELECT COUNT(*) FROM event_attendees WHERE event_id = $1`,
            eventID).Scan(&count)
    }
    return count, err
}
