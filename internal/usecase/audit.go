package usecase

import (
    "context"
    "encoding/json"
    "log"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type AuditUsecase struct {
    auditRepo repository.AuditRepository
}

func NewAuditUsecase(auditRepo repository.AuditRepository) *AuditUsecase {
    return &AuditUsecase{auditRepo: auditRepo}
}

// Log записывает действие в audit_logs
func (u *AuditUsecase) Log(ctx context.Context, actorID int64, action, entityType string, entityID int64, metadata map[string]interface{}, ip, userAgent string) {
    var metaStr string
    if metadata != nil {
        if b, err := json.Marshal(metadata); err == nil {
            metaStr = string(b)
        }
    }
    var actorPtr, entityPtr *int64
    if actorID > 0 {
        actorPtr = &actorID
    }
    if entityID > 0 {
        entityPtr = &entityID
    }
    entry := &domain.AuditLog{
        ActorID:    actorPtr,
        Action:     action,
        EntityType: entityType,
        EntityID:   entityPtr,
        Metadata:   metaStr,
        IP:         ip,
        UserAgent:  userAgent,
    }
    if err := u.auditRepo.Create(ctx, entry); err != nil {
        log.Printf("Failed to write audit log: %v", err)
    }
}

func (u *AuditUsecase) List(ctx context.Context, limit, offset int) ([]domain.AuditLog, error) {
    return u.auditRepo.List(ctx, limit, offset)
}
