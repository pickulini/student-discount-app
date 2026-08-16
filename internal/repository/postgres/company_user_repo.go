package postgres

import (
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type CompanyUserRepo struct {
    db *DB
}

func NewCompanyUserRepo(db *DB) repository.CompanyUserRepository {
    return &CompanyUserRepo{db: db}
}

func (r *CompanyUserRepo) Create(ctx context.Context, cu *domain.CompanyUser) error {
    query := `INSERT INTO company_users (user_id, company_id, role) VALUES ($1, $2, $3) RETURNING id, created_at`
    err := r.db.Pool.QueryRow(ctx, query, cu.UserID, cu.CompanyID, cu.Role).Scan(&cu.ID, &cu.CreatedAt)
    return err
}

func (r *CompanyUserRepo) GetByUserID(ctx context.Context, userID int64) ([]domain.CompanyUser, error) {
    query := `SELECT id, user_id, company_id, role, created_at FROM company_users WHERE user_id = $1`
    rows, err := r.db.Pool.Query(ctx, query, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var list []domain.CompanyUser
    for rows.Next() {
        var cu domain.CompanyUser
        if err := rows.Scan(&cu.ID, &cu.UserID, &cu.CompanyID, &cu.Role, &cu.CreatedAt); err != nil {
            return nil, err
        }
        list = append(list, cu)
    }
    return list, nil
}

func (r *CompanyUserRepo) GetByCompanyID(ctx context.Context, companyID int64) ([]domain.CompanyUser, error) {
    query := `SELECT id, user_id, company_id, role, created_at FROM company_users WHERE company_id = $1`
    rows, err := r.db.Pool.Query(ctx, query, companyID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var list []domain.CompanyUser
    for rows.Next() {
        var cu domain.CompanyUser
        if err := rows.Scan(&cu.ID, &cu.UserID, &cu.CompanyID, &cu.Role, &cu.CreatedAt); err != nil {
            return nil, err
        }
        list = append(list, cu)
    }
    return list, nil
}

func (r *CompanyUserRepo) Delete(ctx context.Context, id int64) error {
    _, err := r.db.Pool.Exec(ctx, `DELETE FROM company_users WHERE id = $1`, id)
    return err
}

func (r *CompanyUserRepo) UpdateRole(ctx context.Context, id int64, role string) error {
    _, err := r.db.Pool.Exec(ctx, `UPDATE company_users SET role = $1 WHERE id = $2`, role, id)
    return err
}
