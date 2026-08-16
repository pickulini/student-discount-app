package postgres

import (
    "context"
    "your-project/internal/domain"
)

type UniversityRepo struct{}

func (r *UniversityRepo) GetByDomain(ctx context.Context, domain string) (*domain.University, error) { return nil, nil }
func (r *UniversityRepo) GetByID(ctx context.Context, id int64) (*domain.University, error) { return nil, nil }
