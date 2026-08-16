package postgres

import (
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type LocationRepo struct {
    db *DB
}

func NewLocationRepo(db *DB) repository.LocationRepository {
    return &LocationRepo{db: db}
}

func (r *LocationRepo) Create(ctx context.Context, l *domain.CompanyLocation) error {
    query := `INSERT INTO company_locations (company_id, name, address, latitude, longitude, phone, opening_hours, is_active) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at, updated_at`
    err := r.db.Pool.QueryRow(ctx, query,
        l.CompanyID, l.Name, l.Address, l.Latitude, l.Longitude, l.Phone, l.OpeningHours, l.IsActive,
    ).Scan(&l.ID, &l.CreatedAt, &l.UpdatedAt)
    return err
}

func (r *LocationRepo) GetByCompanyID(ctx context.Context, companyID int64) ([]domain.CompanyLocation, error) {
    query := `SELECT id, company_id, name, address, latitude, longitude, phone, opening_hours, is_active, created_at, updated_at 
              FROM company_locations WHERE company_id = $1`
    rows, err := r.db.Pool.Query(ctx, query, companyID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var locations []domain.CompanyLocation
    for rows.Next() {
        var l domain.CompanyLocation
        if err := rows.Scan(&l.ID, &l.CompanyID, &l.Name, &l.Address, &l.Latitude, &l.Longitude,
            &l.Phone, &l.OpeningHours, &l.IsActive, &l.CreatedAt, &l.UpdatedAt); err != nil {
            return nil, err
        }
        locations = append(locations, l)
    }
    return locations, nil
}

func (r *LocationRepo) GetNearby(ctx context.Context, lat, lng float64, radius int) ([]domain.CompanyLocation, error) {
    // Пока заглушка, позже добавим PostGIS
    return []domain.CompanyLocation{}, nil
}
