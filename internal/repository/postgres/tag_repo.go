package postgres

import (
	"context"

	"your-project/internal/domain"
	"your-project/internal/repository"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type TagRepo struct {
	db *DB
}

func NewTagRepo(db *DB) repository.TagRepository {
	return &TagRepo{db: db}
}

// ---- Публичные (только active) ----

func (r *TagRepo) List(ctx context.Context) ([]domain.Tag, error) {
	query := `SELECT id, name, slug, status, created_by, created_at
	          FROM tags
	          WHERE status = 'active'
	          ORDER BY name`
	return r.scanTags(ctx, query)
}

func (r *TagRepo) ListPopular(ctx context.Context, limit int) ([]domain.TagPopular, error) {
	if limit <= 0 || limit > 50 {
		limit = 12
	}
	query := `
		SELECT t.id, t.name, t.slug, COUNT(ot.offer_id) AS offer_count
		FROM tags t
		LEFT JOIN offer_tags ot ON ot.tag_id = t.id
		LEFT JOIN offers o ON o.id = ot.offer_id AND o.status = 'published'
		WHERE t.status = 'active'
		GROUP BY t.id, t.name, t.slug
		ORDER BY offer_count DESC, t.name ASC
		LIMIT $1`
	rows, err := r.db.Pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]domain.TagPopular, 0)
	for rows.Next() {
		var t domain.TagPopular
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.OfferCount); err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, rows.Err()
}

func (r *TagRepo) Search(ctx context.Context, q string, limit int) ([]domain.Tag, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	if q == "" {
		return []domain.Tag{}, nil
	}
	pattern := "%" + q + "%"
	// ищем только active — чтобы партнёр не тянул pending от других
	query := `SELECT id, name, slug, status, created_by, created_at
	          FROM tags
	          WHERE status = 'active' AND (name ILIKE $1 OR slug ILIKE $1)
	          ORDER BY length(name), name
	          LIMIT $2`
	return r.scanTags(ctx, query, pattern, limit)
}

func (r *TagRepo) GetBySlug(ctx context.Context, slug string) (*domain.Tag, error) {
	query := `SELECT id, name, slug, status, created_by, created_at
	          FROM tags WHERE lower(slug) = lower($1)`
	var t domain.Tag
	err := r.db.Pool.QueryRow(ctx, query, slug).Scan(
		&t.ID, &t.Name, &t.Slug, &t.Status, &t.CreatedBy, &t.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TagRepo) GetByIDs(ctx context.Context, ids []int64) ([]domain.Tag, error) {
	if len(ids) == 0 {
		return []domain.Tag{}, nil
	}
	query := `SELECT id, name, slug, status, created_by, created_at
	          FROM tags WHERE id = ANY($1)`
	return r.scanTags(ctx, query, ids)
}

func (r *TagRepo) ListAllAdmin(ctx context.Context, status string, limit, offset int) ([]domain.Tag, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	if status != "" {
		query := `SELECT id, name, slug, status, created_by, created_at
		          FROM tags WHERE status = $1
		          ORDER BY created_at DESC
		          LIMIT $2 OFFSET $3`
		return r.scanTags(ctx, query, status, limit, offset)
	}
	query := `SELECT id, name, slug, status, created_by, created_at
	          FROM tags ORDER BY created_at DESC LIMIT $1 OFFSET $2`
	return r.scanTags(ctx, query, limit, offset)
}

// ---- Создание / upsert ----

func (r *TagRepo) Upsert(ctx context.Context, name, slug string, createdBy *int64) (*domain.Tag, error) {
	// сначала пробуем найти по slug
	existing, err := r.GetBySlug(ctx, slug)
	if err == nil && existing != nil {
		return existing, nil
	}

	query := `INSERT INTO tags (name, slug, status, created_by)
	          VALUES ($1, $2, 'pending', $3)
	          ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
	          RETURNING id, name, slug, status, created_by, created_at`
	var t domain.Tag
	err = r.db.Pool.QueryRow(ctx, query, name, slug, createdBy).Scan(
		&t.ID, &t.Name, &t.Slug, &t.Status, &t.CreatedBy, &t.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ---- Связь с офферами ----

func (r *TagRepo) SetOfferTags(ctx context.Context, offerID int64, tagIDs []int64) error {
	return r.setOfferTags(ctx, r.db.Pool, offerID, tagIDs)
}

func (r *TagRepo) SetOfferTagsTx(ctx context.Context, tx pgx.Tx, offerID int64, tagIDs []int64) error {
	return r.setOfferTags(ctx, tx, offerID, tagIDs)
}

func (r *TagRepo) setOfferTags(ctx context.Context, q interface {
	Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
}, offerID int64, tagIDs []int64) error {
	_, err := q.Exec(ctx, `DELETE FROM offer_tags WHERE offer_id = $1`, offerID)
	if err != nil {
		return err
	}
	for _, tagID := range tagIDs {
		_, err := q.Exec(ctx,
			`INSERT INTO offer_tags (offer_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			offerID, tagID)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *TagRepo) GetTagsByOfferIDs(ctx context.Context, offerIDs []int64) (map[int64][]domain.Tag, error) {
	if len(offerIDs) == 0 {
		return map[int64][]domain.Tag{}, nil
	}
	query := `
		SELECT ot.offer_id, t.id, t.name, t.slug, t.status, t.created_by, t.created_at
		FROM offer_tags ot
		JOIN tags t ON t.id = ot.tag_id
		WHERE ot.offer_id = ANY($1)
		ORDER BY t.name`
	rows, err := r.db.Pool.Query(ctx, query, offerIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[int64][]domain.Tag)
	for rows.Next() {
		var offerID int64
		var t domain.Tag
		if err := rows.Scan(&offerID, &t.ID, &t.Name, &t.Slug, &t.Status, &t.CreatedBy, &t.CreatedAt); err != nil {
			return nil, err
		}
		result[offerID] = append(result[offerID], t)
	}
	return result, rows.Err()
}

// ---- Автомодерация ----

// ActivateByOfferID переводит все pending-теги, привязанные к офферу, в active.
// Вызывается при публикации оффера админом.
func (r *TagRepo) ActivateByOfferID(ctx context.Context, offerID int64) error {
	query := `
		UPDATE tags SET status = 'active'
		WHERE id IN (SELECT tag_id FROM offer_tags WHERE offer_id = $1)
		  AND status = 'pending'`
	_, err := r.db.Pool.Exec(ctx, query, offerID)
	return err
}

// ---- helpers ----

func (r *TagRepo) scanTags(ctx context.Context, query string, args ...interface{}) ([]domain.Tag, error) {
	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]domain.Tag, 0)
	for rows.Next() {
		var t domain.Tag
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.Status, &t.CreatedBy, &t.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, rows.Err()
}
