package domain

import "time"

type AuditLog struct {
    ID         int64     `json:"id"`
    ActorID    *int64    `json:"actor_id,omitempty"`
    Action     string    `json:"action"`
    EntityType string    `json:"entity_type"`
    EntityID   *int64    `json:"entity_id,omitempty"`
    Metadata   string    `json:"metadata,omitempty"` // JSON-строка
    IP         string    `json:"ip,omitempty"`
    UserAgent  string    `json:"user_agent,omitempty"`
    CreatedAt  time.Time `json:"created_at"`
}
