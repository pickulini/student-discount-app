package memory

import (
    "context"
    "sync"
    "your-project/internal/domain"
)

type CompanyRepo struct {
    mu    sync.RWMutex
    store map[int64]domain.Company
    idSeq int64
}

func NewCompanyRepo() *CompanyRepo {
    return &CompanyRepo{
        store: make(map[int64]domain.Company),
        idSeq: 1,
    }
}

func (r *CompanyRepo) Create(ctx context.Context, c *domain.Company) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    c.ID = r.idSeq
    r.store[r.idSeq] = *c
    r.idSeq++
    return nil
}

func (r *CompanyRepo) GetByID(ctx context.Context, id int64) (*domain.Company, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    if c, ok := r.store[id]; ok {
        return &c, nil
    }
    return nil, domain.ErrUserNotFound
}

func (r *CompanyRepo) List(ctx context.Context, limit, offset int) ([]domain.Company, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    result := []domain.Company{}
    for _, c := range r.store {
        result = append(result, c)
    }
    if len(result) > limit {
        result = result[:limit]
    }
    return result, nil
}
