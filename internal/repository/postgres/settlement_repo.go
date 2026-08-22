package postgres

import (
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type SettlementRepo struct {
    db *DB
}

func NewSettlementRepo(db *DB) repository.SettlementRepository {
    return &SettlementRepo{db: db}
}

func (r *SettlementRepo) Create(ctx context.Context, s *domain.Settlement) error {
    query := `INSERT INTO settlements (company_id, period_start, period_end, gross_amount, commission_amount, net_amount, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at, updated_at`
    err := r.db.Pool.QueryRow(ctx, query,
        s.CompanyID, s.PeriodStart, s.PeriodEnd, s.GrossAmount, s.CommissionAmount, s.NetAmount, s.Status,
    ).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
    return err
}

func (r *SettlementRepo) GetByCompanyID(ctx context.Context, companyID int64) ([]domain.Settlement, error) {
    query := `SELECT id, company_id, period_start, period_end, gross_amount, commission_amount, net_amount, status, paid_at, created_at, updated_at FROM settlements WHERE company_id = $1 ORDER BY period_end DESC`
    rows, err := r.db.Pool.Query(ctx, query, companyID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var list []domain.Settlement
    for rows.Next() {
        var s domain.Settlement
        if err := rows.Scan(&s.ID, &s.CompanyID, &s.PeriodStart, &s.PeriodEnd, &s.GrossAmount, &s.CommissionAmount, &s.NetAmount, &s.Status, &s.PaidAt, &s.CreatedAt, &s.UpdatedAt); err != nil {
            return nil, err
        }
        list = append(list, s)
    }
    return list, nil
}

func (r *SettlementRepo) UpdateStatus(ctx context.Context, id int64, status string) error {
    query := `UPDATE settlements SET status = $1, updated_at = NOW() WHERE id = $2`
    _, err := r.db.Pool.Exec(ctx, query, status, id)
    return err
}
