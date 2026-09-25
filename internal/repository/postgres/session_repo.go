package postgres

import (
    "context"
    "time"

    "your-project/internal/domain"
    "your-project/internal/repository"
)

type SessionRepo struct {
    db *DB
}

func NewSessionRepo(db *DB) repository.SessionRepository {
    return &SessionRepo{db: db}
}

func (r *SessionRepo) Create(ctx context.Context, s *domain.UserSession) error {
    query := `INSERT INTO user_sessions (user_id, refresh_token_hash, device_name, user_agent, ip, expires_at)
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING id, created_at, last_used_at`
    return r.db.Pool.QueryRow(ctx, query,
        s.UserID, s.RefreshTokenHash, s.DeviceName, s.UserAgent, s.IP, s.ExpiresAt,
    ).Scan(&s.ID, &s.CreatedAt, &s.LastUsedAt)
}

func (r *SessionRepo) GetByRefreshTokenHash(ctx context.Context, hash string) (*domain.UserSession, error) {
    query := `SELECT id, user_id, refresh_token_hash, COALESCE(device_name, ''), COALESCE(user_agent, ''),
                     COALESCE(ip, ''), created_at, last_used_at, expires_at, revoked_at
              FROM user_sessions WHERE refresh_token_hash = $1`
    var s domain.UserSession
    err := r.db.Pool.QueryRow(ctx, query, hash).Scan(
        &s.ID, &s.UserID, &s.RefreshTokenHash, &s.DeviceName, &s.UserAgent,
        &s.IP, &s.CreatedAt, &s.LastUsedAt, &s.ExpiresAt, &s.RevokedAt,
    )
    if err != nil {
        return nil, err
    }
    return &s, nil
}

func (r *SessionRepo) Revoke(ctx context.Context, id int64) error {
    _, err := r.db.Pool.Exec(ctx,
        `UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`, id)
    return err
}

func (r *SessionRepo) RevokeAll(ctx context.Context, userID int64) error {
    _, err := r.db.Pool.Exec(ctx,
        `UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, userID)
    return err
}

func (r *SessionRepo) UpdateLastUsed(ctx context.Context, id int64) error {
    _, err := r.db.Pool.Exec(ctx,
        `UPDATE user_sessions SET last_used_at = $1 WHERE id = $2`, time.Now(), id)
    return err
}

func (r *SessionRepo) ListByUserID(ctx context.Context, userID int64) ([]domain.UserSession, error) {
    query := `SELECT id, user_id, refresh_token_hash, COALESCE(device_name, ''), COALESCE(user_agent, ''),
                     COALESCE(ip, ''), created_at, last_used_at, expires_at, revoked_at
              FROM user_sessions
              WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
              ORDER BY last_used_at DESC`
    rows, err := r.db.Pool.Query(ctx, query, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    result := make([]domain.UserSession, 0)
    for rows.Next() {
        var s domain.UserSession
        if err := rows.Scan(&s.ID, &s.UserID, &s.RefreshTokenHash, &s.DeviceName,
            &s.UserAgent, &s.IP, &s.CreatedAt, &s.LastUsedAt, &s.ExpiresAt, &s.RevokedAt); err != nil {
            return nil, err
        }
        result = append(result, s)
    }
    return result, rows.Err()
}

func (r *SessionRepo) GetByID(ctx context.Context, id int64) (*domain.UserSession, error) {
    query := `SELECT id, user_id, refresh_token_hash, COALESCE(device_name, ''), COALESCE(user_agent, ''),
                     COALESCE(ip, ''), created_at, last_used_at, expires_at, revoked_at
              FROM user_sessions WHERE id = $1`
    var s domain.UserSession
    err := r.db.Pool.QueryRow(ctx, query, id).Scan(&s.ID, &s.UserID, &s.RefreshTokenHash,
        &s.DeviceName, &s.UserAgent, &s.IP, &s.CreatedAt, &s.LastUsedAt, &s.ExpiresAt, &s.RevokedAt)
    if err != nil {
        return nil, err
    }
    return &s, nil
}

// RevokeAllExcept — отозвать все сессии пользователя, кроме keepID.
func (r *SessionRepo) RevokeAllExcept(ctx context.Context, userID, keepID int64) error {
    _, err := r.db.Pool.Exec(ctx,
        `UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`, userID, keepID)
    return err
}

// Touch — сессия жива? Заодно отмечает время последней активности.
func (r *SessionRepo) Touch(ctx context.Context, id, userID int64) (bool, error) {
    tag, err := r.db.Pool.Exec(ctx,
        `UPDATE user_sessions SET last_used_at = NOW()
          WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()`, id, userID)
    if err != nil {
        return false, err
    }
    return tag.RowsAffected() > 0, nil
}

// Extend — продлить сессию (при обновлении токена) и отметить активность.
func (r *SessionRepo) Extend(ctx context.Context, id int64, until time.Time) error {
    _, err := r.db.Pool.Exec(ctx,
        `UPDATE user_sessions SET expires_at = $2, last_used_at = NOW() WHERE id = $1 AND revoked_at IS NULL`, id, until)
    return err
}
