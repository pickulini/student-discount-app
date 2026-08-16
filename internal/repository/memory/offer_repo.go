package memory

import (
    "context"
    "sync"
    "time"
    "your-project/internal/domain"
)

type OfferRepo struct {
    mu    sync.RWMutex
    store map[int64]domain.Offer
    idSeq int64
}

func NewOfferRepo() *OfferRepo {
    r := &OfferRepo{store: make(map[int64]domain.Offer), idSeq: 1}
    // Заполняем демо-предложениями
    now := time.Now()
    offers := []domain.Offer{
        {Title: "Скидка 20% на кофе", Description: "Всё меню", DiscountType: "percentage", DiscountValue: 20, StartAt: now, EndAt: now.AddDate(0, 1, 0), Status: "published", BonusAllowed: true, MaxBonusPercent: 20},
        {Title: "Пицца со скидкой 15%", Description: "На любую пиццу", DiscountType: "percentage", DiscountValue: 15, StartAt: now, EndAt: now.AddDate(0, 0, 15), Status: "published", BonusAllowed: false},
        {Title: "Кино со скидкой 100 руб", Description: "На любой сеанс", DiscountType: "fixed", DiscountValue: 100, StartAt: now, EndAt: now.AddDate(0, 0, 7), Status: "published", BonusAllowed: true, MaxBonusPercent: 10},
        {Title: "Абонемент в спортзал -10%", Description: "На месяц", DiscountType: "percentage", DiscountValue: 10, StartAt: now, EndAt: now.AddDate(0, 2, 0), Status: "published", BonusAllowed: true, MaxBonusPercent: 30},
    }
    for _, o := range offers {
        o.ID = r.idSeq
        r.store[r.idSeq] = o
        r.idSeq++
    }
    return r
}
func (r *OfferRepo) Create(ctx context.Context, o *domain.Offer) error { return nil }
func (r *OfferRepo) GetByID(ctx context.Context, id int64) (*domain.Offer, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    if o, ok := r.store[id]; ok {
        return &o, nil
    }
    return nil, domain.ErrUserNotFound
}
func (r *OfferRepo) List(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]domain.Offer, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    result := []domain.Offer{}
    for _, o := range r.store {
        if o.Status == "published" {
            result = append(result, o)
        }
    }
    return result, nil
}
func (r *OfferRepo) GetActiveOffers(ctx context.Context) ([]domain.Offer, error) {
    return r.List(ctx, nil, 100, 0)
}
func (r *OfferRepo) IncrementUses(ctx context.Context, id int64) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    if o, ok := r.store[id]; ok {
        o.CurrentUses++
        r.store[id] = o
    }
    return nil
}
