package memory

import (
    "context"
    "sync"
    "your-project/internal/domain"
)

type LocationRepo struct {
    mu    sync.RWMutex
    store map[int64]domain.CompanyLocation
    idSeq int64
}

func NewLocationRepo() *LocationRepo {
    return &LocationRepo{store: make(map[int64]domain.CompanyLocation), idSeq: 1}
}
func (r *LocationRepo) Create(ctx context.Context, l *domain.CompanyLocation) error { return nil }
func (r *LocationRepo) GetByCompanyID(ctx context.Context, companyID int64) ([]domain.CompanyLocation, error) { return []domain.CompanyLocation{}, nil }
func (r *LocationRepo) GetNearby(ctx context.Context, lat, lng float64, radius int) ([]domain.CompanyLocation, error) { return []domain.CompanyLocation{}, nil }
