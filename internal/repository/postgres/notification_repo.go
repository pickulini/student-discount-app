package postgres

import (
    "context"

    "your-project/internal/domain"
    "your-project/internal/repository"
)

type NotificationRepo struct {
    db *DB
}

func NewNotificationRepo(db *DB) repository.NotificationRepository {
    return &NotificationRepo{db: db}
}

func (r *NotificationRepo) Create(ctx context.Context, n *domain.Notification) error {
    query := `INSERT INTO notifications
                (user_id, type, category, title, body, link, actor_id, reference_type, reference_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              RETURNING id, created_at`
    return r.db.Pool.QueryRow(ctx, query,
        n.UserID, n.Type, n.Category, n.Title, n.Body, n.Link,
        n.ActorID, n.ReferenceType, n.ReferenceID,
    ).Scan(&n.ID, &n.CreatedAt)
}

func (r *NotificationRepo) GetByID(ctx context.Context, id int64) (*domain.Notification, error) {
    query := `SELECT id, user_id, type, category, title, body, link, actor_id,
                     reference_type, reference_id, read_at, created_at
              FROM notifications WHERE id = $1`
    var n domain.Notification
    err := r.db.Pool.QueryRow(ctx, query, id).Scan(
        &n.ID, &n.UserID, &n.Type, &n.Category, &n.Title, &n.Body, &n.Link,
        &n.ActorID, &n.ReferenceType, &n.ReferenceID, &n.ReadAt, &n.CreatedAt,
    )
    if err != nil {
        return nil, err
    }
    return &n, nil
}

// loadActors — подтягивает username/nickname/avatar для actor_id
func (r *NotificationRepo) loadActors(ctx context.Context, list []domain.Notification) {
    ids := make([]int64, 0)
    for _, n := range list {
        if n.ActorID != nil {
            ids = append(ids, *n.ActorID)
        }
    }
    if len(ids) == 0 {
        return
    }
    rows, err := r.db.Pool.Query(ctx,
        `SELECT id, username, nickname, full_name, avatar_url FROM users WHERE id = ANY($1)`, ids)
    if err != nil {
        return
    }
    defer rows.Close()
    type actor struct {
        username, nickname, fullName, avatar string
    }
    actors := map[int64]actor{}
    for rows.Next() {
        var id int64
        var username, nickname, fullName, avatar *string
        if err := rows.Scan(&id, &username, &nickname, &fullName, &avatar); err != nil {
            continue
        }
        a := actor{}
        if username != nil {
            a.username = *username
        }
        if nickname != nil {
            a.nickname = *nickname
        }
        if fullName != nil {
            a.fullName = *fullName
        }
        if avatar != nil {
            a.avatar = *avatar
        }
        actors[id] = a
    }
    for i := range list {
        if list[i].ActorID == nil {
            continue
        }
        if a, ok := actors[*list[i].ActorID]; ok {
            if a.username != "" {
                list[i].ActorUsername = &a.username
            }
            if a.nickname != "" {
                list[i].ActorName = &a.nickname
            } else if a.fullName != "" {
                list[i].ActorName = &a.fullName
            }
            if a.avatar != "" {
                list[i].ActorAvatar = &a.avatar
            }
        }
    }
}

func (r *NotificationRepo) ListByUser(ctx context.Context, userID int64, limit, offset int) ([]domain.Notification, error) {
    if limit <= 0 || limit > 100 {
        limit = 50
    }
    query := `SELECT id, user_id, type, category, title, body, link, actor_id,
                     reference_type, reference_id, read_at, created_at
              FROM notifications
              WHERE user_id = $1
              ORDER BY created_at DESC
              LIMIT $2 OFFSET $3`
    rows, err := r.db.Pool.Query(ctx, query, userID, limit, offset)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    result := make([]domain.Notification, 0)
    for rows.Next() {
        var n domain.Notification
        if err := rows.Scan(
            &n.ID, &n.UserID, &n.Type, &n.Category, &n.Title, &n.Body, &n.Link,
            &n.ActorID, &n.ReferenceType, &n.ReferenceID, &n.ReadAt, &n.CreatedAt,
        ); err != nil {
            return nil, err
        }
        result = append(result, n)
    }
    r.loadActors(ctx, result)
    return result, rows.Err()
}

func (r *NotificationRepo) ListUnread(ctx context.Context, userID int64) ([]domain.Notification, error) {
    query := `SELECT id, user_id, type, category, title, body, link, actor_id,
                     reference_type, reference_id, read_at, created_at
              FROM notifications
              WHERE user_id = $1 AND read_at IS NULL
              ORDER BY created_at DESC
              LIMIT 100`
    rows, err := r.db.Pool.Query(ctx, query, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    result := make([]domain.Notification, 0)
    for rows.Next() {
        var n domain.Notification
        if err := rows.Scan(
            &n.ID, &n.UserID, &n.Type, &n.Category, &n.Title, &n.Body, &n.Link,
            &n.ActorID, &n.ReferenceType, &n.ReferenceID, &n.ReadAt, &n.CreatedAt,
        ); err != nil {
            return nil, err
        }
        result = append(result, n)
    }
    r.loadActors(ctx, result)
    return result, rows.Err()
}

func (r *NotificationRepo) CountUnread(ctx context.Context, userID int64) (int, error) {
    var count int
    err := r.db.Pool.QueryRow(ctx,
        `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
        userID).Scan(&count)
    return count, err
}

func (r *NotificationRepo) MarkRead(ctx context.Context, id, userID int64) error {
    _, err := r.db.Pool.Exec(ctx,
        `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
        id, userID)
    return err
}

func (r *NotificationRepo) MarkAllRead(ctx context.Context, userID int64) error {
    _, err := r.db.Pool.Exec(ctx,
        `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
        userID)
    return err
}

func (r *NotificationRepo) DeleteOld(ctx context.Context, days int) (int, error) {
    tag, err := r.db.Pool.Exec(ctx,
        `DELETE FROM notifications WHERE created_at < NOW() - ($1 || ' days')::interval`,
        days)
    if err != nil {
        return 0, err
    }
    return int(tag.RowsAffected()), nil
}

func (r *NotificationRepo) Delete(ctx context.Context, id, userID int64) error {
    _, err := r.db.Pool.Exec(ctx,
        `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
        id, userID)
    return err
}
