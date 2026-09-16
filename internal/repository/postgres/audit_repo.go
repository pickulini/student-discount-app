package postgres

import (
    "context"
    "database/sql"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type AuditRepo struct {
    db *DB
}

func NewAuditRepo(db *DB) repository.AuditRepository {
    return &AuditRepo{db: db}
}

func (r *AuditRepo) Create(ctx context.Context, log *domain.AuditLog) error {
    query := `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, ip, user_agent)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING id, created_at`
    var meta interface{}
    if log.Metadata != "" {
        meta = log.Metadata
    }
    err := r.db.Pool.QueryRow(ctx, query,
        log.ActorID, log.Action, log.EntityType, log.EntityID, meta, log.IP, log.UserAgent,
    ).Scan(&log.ID, &log.CreatedAt)
    return err
}

func (r *AuditRepo) List(ctx context.Context, limit, offset int) ([]domain.AuditLog, error) {
    query := `SELECT id, actor_id, action, entity_type, entity_id, metadata, ip, user_agent, created_at
              FROM audit_logs ORDER BY id DESC LIMIT $1 OFFSET $2`
    return r.scanRows(ctx, query, limit, offset)
}

func (r *AuditRepo) ListByActor(ctx context.Context, actorID int64, limit, offset int) ([]domain.AuditLog, error) {
    query := `SELECT id, actor_id, action, entity_type, entity_id, metadata, ip, user_agent, created_at
              FROM audit_logs WHERE actor_id = $1 ORDER BY id DESC LIMIT $2 OFFSET $3`
    return r.scanRows(ctx, query, actorID, limit, offset)
}

func (r *AuditRepo) ListByEntity(ctx context.Context, entityType string, entityID int64) ([]domain.AuditLog, error) {
    query := `SELECT id, actor_id, action, entity_type, entity_id, metadata, ip, user_agent, created_at
              FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY id DESC LIMIT 100`
    return r.scanRows(ctx, query, entityType, entityID)
}

func (r *AuditRepo) scanRows(ctx context.Context, query string, args ...interface{}) ([]domain.AuditLog, error) {
    rows, err := r.db.Pool.Query(ctx, query, args...)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var logs []domain.AuditLog
    for rows.Next() {
        var l domain.AuditLog
        var actorID, entityID sql.NullInt64
        var metadata, ip, userAgent sql.NullString
        if err := rows.Scan(&l.ID, &actorID, &l.Action, &l.EntityType, &entityID,
            &metadata, &ip, &userAgent, &l.CreatedAt); err != nil {
            return nil, err
        }
        if actorID.Valid {
            l.ActorID = &actorID.Int64
        }
        if entityID.Valid {
            l.EntityID = &entityID.Int64
        }
        if metadata.Valid {
            l.Metadata = metadata.String
        }
        if ip.Valid {
            l.IP = ip.String
        }
        if userAgent.Valid {
            l.UserAgent = userAgent.String
        }
        logs = append(logs, l)
    }
    return logs, nil
}
