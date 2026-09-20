package postgres

import (
    "context"

    "encoding/json"

    "your-project/internal/domain"
    "your-project/internal/repository"
)

type UniversityRepo struct {
    db *DB
}

func NewUniversityRepo(db *DB) repository.UniversityRepository {
    return &UniversityRepo{db: db}
}

func (r *UniversityRepo) GetByDomain(ctx context.Context, domainName string) (*domain.University, error) {
    query := `SELECT id, name, short_name, domains, is_active, created_at, updated_at
              FROM universities
              WHERE is_active = true AND domains @> to_jsonb($1::text)
              LIMIT 1`
    var u domain.University
    var domainsJSON []byte
    err := r.db.Pool.QueryRow(ctx, query, domainName).Scan(
        &u.ID, &u.Name, &u.ShortName, &domainsJSON, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
    )
    if err != nil {
        return nil, err
    }
    if len(domainsJSON) > 0 {
        _ = json.Unmarshal(domainsJSON, &u.Domains)
    }
    if u.Domains == nil {
        u.Domains = []string{}
    }
    return &u, nil
}

func (r *UniversityRepo) GetByID(ctx context.Context, id int64) (*domain.University, error) {
    query := `SELECT id, name, short_name, domains, is_active, created_at, updated_at
              FROM universities WHERE id = $1`
    var u domain.University
    var domainsJSON []byte
    err := r.db.Pool.QueryRow(ctx, query, id).Scan(
        &u.ID, &u.Name, &u.ShortName, &domainsJSON, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
    )
    if err != nil {
        return nil, err
    }
    if len(domainsJSON) > 0 {
        _ = json.Unmarshal(domainsJSON, &u.Domains)
    }
    if u.Domains == nil {
        u.Domains = []string{}
    }
    return &u, nil
}

func (r *UniversityRepo) ListActive(ctx context.Context) ([]domain.University, error) {
    query := `SELECT id, name, short_name, domains, is_active, created_at, updated_at
              FROM universities
              WHERE is_active = true
              ORDER BY name`
    rows, err := r.db.Pool.Query(ctx, query)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    result := make([]domain.University, 0)
    for rows.Next() {
        var u domain.University
        var domainsJSON []byte
        if err := rows.Scan(&u.ID, &u.Name, &u.ShortName, &domainsJSON, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
            return nil, err
        }
        if len(domainsJSON) > 0 {
            _ = json.Unmarshal(domainsJSON, &u.Domains)
        }
        if u.Domains == nil {
            u.Domains = []string{}
        }
        result = append(result, u)
    }
    return result, rows.Err()
}
