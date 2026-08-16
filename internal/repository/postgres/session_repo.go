package postgres

import (
    "context"
    "your-project/internal/domain"
)

type SessionRepo struct{}

func (r *SessionRepo) Create(ctx context.Context, s *domain.UserSession) error { return nil }
func (r *SessionRepo) GetByRefreshTokenHash(ctx context.Context, hash string) (*domain.UserSession, error) { return nil, nil }
func (r *SessionRepo) Revoke(ctx context.Context, id int64) error { return nil }
func (r *SessionRepo) RevokeAll(ctx context.Context, userID int64) error { return nil }
func (r *SessionRepo) UpdateLastUsed(ctx context.Context, id int64) error { return nil }
