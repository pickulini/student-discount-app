package postgres

import (
    "context"
    "database/sql"
    "log"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type CompanyRepo struct {
    db *DB
}

func NewCompanyRepo(db *DB) repository.CompanyRepository {
    return &CompanyRepo{db: db}
}

func (r *CompanyRepo) Create(ctx context.Context, c *domain.Company) error {
    query := `INSERT INTO companies (name, description, logo_key, website, phone, category_id, is_active) 
              VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at, updated_at`
    err := r.db.Pool.QueryRow(ctx, query,
        c.Name, c.Description, c.LogoKey, c.Website, c.Phone, c.CategoryID, c.IsActive,
    ).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
    return err
}

func (r *CompanyRepo) GetByID(ctx context.Context, id int64) (*domain.Company, error) {
    query := `SELECT id, name, description, logo_key, website, phone, category_id, is_active, created_at, updated_at 
              FROM companies WHERE id = $1`
    var c domain.Company
    var logoKey, website, phone sql.NullString
    var categoryID sql.NullInt64
    err := r.db.Pool.QueryRow(ctx, query, id).Scan(
        &c.ID, &c.Name, &c.Description, &logoKey, &website, &phone,
        &categoryID, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
    )
    if err != nil {
        return nil, err
    }
    if logoKey.Valid {
        c.LogoKey = &logoKey.String
    }
    if website.Valid {
        c.Website = &website.String
    }
    if phone.Valid {
        c.Phone = &phone.String
    }
    if categoryID.Valid {
        c.CategoryID = &categoryID.Int64
    }
    return &c, nil
}

func (r *CompanyRepo) List(ctx context.Context, limit, offset int) ([]domain.Company, error) {
    query := `SELECT id, name, description, logo_key, website, phone, category_id, is_active, created_at, updated_at 
              FROM companies ORDER BY id LIMIT $1 OFFSET $2`
    rows, err := r.db.Pool.Query(ctx, query, limit, offset)
    if err != nil {
        log.Printf("CompanyRepo.List query error: %v", err)
        return nil, err
    }
    defer rows.Close()
    var companies []domain.Company
    for rows.Next() {
        var c domain.Company
        var logoKey, website, phone sql.NullString
        var categoryID sql.NullInt64
        if err := rows.Scan(&c.ID, &c.Name, &c.Description, &logoKey, &website, &phone,
            &categoryID, &c.IsActive, &c.CreatedAt, &c.UpdatedAt); err != nil {
            log.Printf("CompanyRepo.List scan error: %v", err)
            return nil, err
        }
        if logoKey.Valid {
            c.LogoKey = &logoKey.String
        }
        if website.Valid {
            c.Website = &website.String
        }
        if phone.Valid {
            c.Phone = &phone.String
        }
        if categoryID.Valid {
            c.CategoryID = &categoryID.Int64
        }
        companies = append(companies, c)
    }
    return companies, nil
}

func (r *CompanyRepo) Update(ctx context.Context, c *domain.Company) error {
    query := `UPDATE companies SET name=$1, description=$2, logo_key=$3, website=$4, phone=$5, 
              category_id=$6, is_active=$7, updated_at=NOW() WHERE id=$8`
    _, err := r.db.Pool.Exec(ctx, query,
        c.Name, c.Description, c.LogoKey, c.Website, c.Phone,
        c.CategoryID, c.IsActive, c.ID,
    )
    return err
}

func (r *CompanyRepo) Delete(ctx context.Context, id int64) error {
    query := `DELETE FROM companies WHERE id=$1`
    _, err := r.db.Pool.Exec(ctx, query, id)
    return err
}

// ListByUserUsername — компании, к которым привязан user с указанным username.
// currentUserID = 0 означает гостя (is_subscribed везде false).
func (r *CompanyRepo) ListByUserUsername(ctx context.Context, username string, currentUserID int64) ([]domain.CompanyWithSubscription, error) {
    query := `
        SELECT c.id, c.name, COALESCE(c.description, ''), c.logo_key, c.is_active,
               CASE WHEN $2 > 0 AND cs.user_id IS NOT NULL THEN true ELSE false END AS is_subscribed
        FROM company_users cu
        JOIN users u ON u.id = cu.user_id
        JOIN companies c ON c.id = cu.company_id
        LEFT JOIN company_subscriptions cs
               ON cs.company_id = c.id AND cs.user_id = $2
        WHERE lower(u.username) = lower($1)
          AND c.is_active = true
        ORDER BY c.name`
    rows, err := r.db.Pool.Query(ctx, query, username, currentUserID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    result := make([]domain.CompanyWithSubscription, 0)
    for rows.Next() {
        var c domain.CompanyWithSubscription
        if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.LogoKey, &c.IsActive, &c.IsSubscribed); err != nil {
            return nil, err
        }
        result = append(result, c)
    }
    return result, rows.Err()
}

// ListByUserUsername — компании, привязанные к юзеру по username.
// currentUserID = 0 (гость) → is_subscribed всегда false.
