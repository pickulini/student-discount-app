package postgres

import (
	"context"

	"your-project/internal/domain"
	"your-project/internal/repository"
)

type CompanySubscriptionRepo struct {
	db *DB
}

func NewCompanySubscriptionRepo(db *DB) repository.CompanySubscriptionRepository {
	return &CompanySubscriptionRepo{db: db}
}

func (r *CompanySubscriptionRepo) Subscribe(ctx context.Context, userID, companyID int64) error {
	_, err := r.db.Pool.Exec(ctx,
		`INSERT INTO company_subscriptions (user_id, company_id) VALUES ($1, $2)
		 ON CONFLICT DO NOTHING`,
		userID, companyID)
	return err
}

func (r *CompanySubscriptionRepo) Unsubscribe(ctx context.Context, userID, companyID int64) error {
	_, err := r.db.Pool.Exec(ctx,
		`DELETE FROM company_subscriptions WHERE user_id = $1 AND company_id = $2`,
		userID, companyID)
	return err
}

func (r *CompanySubscriptionRepo) IsSubscribed(ctx context.Context, userID, companyID int64) (bool, error) {
	var exists bool
	err := r.db.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM company_subscriptions WHERE user_id = $1 AND company_id = $2)`,
		userID, companyID).Scan(&exists)
	return exists, err
}

func (r *CompanySubscriptionRepo) CountByCompany(ctx context.Context, companyID int64) (int, error) {
	var count int
	err := r.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM company_subscriptions WHERE company_id = $1`,
		companyID).Scan(&count)
	return count, err
}

func (r *CompanySubscriptionRepo) ListByUser(ctx context.Context, userID int64) ([]domain.Company, error) {
	query := `
		SELECT c.id, c.name, COALESCE(c.description, ''), c.logo_key,
		       COALESCE(c.website, ''), COALESCE(c.phone, ''), c.category_id,
		       c.is_active, c.created_at, c.updated_at
		FROM company_subscriptions s
		JOIN companies c ON c.id = s.company_id
		WHERE s.user_id = $1
		ORDER BY s.created_at DESC`
	rows, err := r.db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]domain.Company, 0)
	for rows.Next() {
		var c domain.Company
		var desc, website, phone string
		if err := rows.Scan(
			&c.ID, &c.Name, &desc, &c.LogoKey,
			&website, &phone, &c.CategoryID,
			&c.IsActive, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		c.Description = desc
		if website != "" {
			c.Website = &website
		}
		if phone != "" {
			c.Phone = &phone
		}
		result = append(result, c)
	}
	return result, rows.Err()
}

func (r *CompanySubscriptionRepo) ListSubscribedCompanyIDs(ctx context.Context, userID int64) ([]int64, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT company_id FROM company_subscriptions WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
