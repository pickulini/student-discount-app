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

func (r *TagRepo) List(ctx context.Context) ([]domain.Tag, error) {
    query := `SELECT id, name, slug, created_at FROM tags ORDER BY name`
    rows, err := r.db.Pool.Query(ctx, query)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var tags []domain.Tag
    for rows.Next() {
        var t domain.Tag
        if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.CreatedAt); err != nil {
            return nil, err
        }
        tags = append(tags, t)
    }
    return tags, nil
}

func (r *TagRepo) GetBySlug(ctx context.Context, slug string) (*domain.Tag, error) {
    query := `SELECT id, name, slug, created_at FROM tags WHERE slug = $1`
    var t domain.Tag
    err := r.db.Pool.QueryRow(ctx, query, slug).Scan(&t.ID, &t.Name, &t.Slug, &t.CreatedAt)
    return &t, err
}

func (r *TagRepo) GetByIDs(ctx context.Context, ids []int64) ([]domain.Tag, error) {
    if len(ids) == 0 {
        return []domain.Tag{}, nil
    }
    query := `SELECT id, name, slug, created_at FROM tags WHERE id = ANY($1)`
    rows, err := r.db.Pool.Query(ctx, query, ids)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var tags []domain.Tag
    for rows.Next() {
        var t domain.Tag
        if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.CreatedAt); err != nil {
            return nil, err
        }
        tags = append(tags, t)
    }
    return tags, nil
}

func (r *TagRepo) SetOfferTags(ctx context.Context, offerID int64, tagIDs []int64) error {
    return r.setOfferTags(ctx, r.db.Pool, offerID, tagIDs)
}

func (r *TagRepo) SetOfferTagsTx(ctx context.Context, tx pgx.Tx, offerID int64, tagIDs []int64) error {
    return r.setOfferTags(ctx, tx, offerID, tagIDs)
}

// setOfferTags принимает любого провайдера (Pool или Tx)
func (r *TagRepo) setOfferTags(ctx context.Context, q interface {
    Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error)
    Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
}, offerID int64, tagIDs []int64) error {
    // Удаляем старые теги
    _, err := q.Exec(ctx, `DELETE FROM offer_tags WHERE offer_id = $1`, offerID)
    if err != nil {
        return err
    }
    // Вставляем новые
    for _, tagID := range tagIDs {
        _, err := q.Exec(ctx, `INSERT INTO offer_tags (offer_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, offerID, tagID)
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
        SELECT ot.offer_id, t.id, t.name, t.slug
        FROM offer_tags ot
        JOIN tags t ON t.id = ot.tag_id
        WHERE ot.offer_id = ANY($1)
    `
    rows, err := r.db.Pool.Query(ctx, query, offerIDs)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    result := make(map[int64][]domain.Tag)
    for rows.Next() {
        var offerID int64
        var t domain.Tag
        if err := rows.Scan(&offerID, &t.ID, &t.Name, &t.Slug); err != nil {
            return nil, err
        }
        result[offerID] = append(result[offerID], t)
    }
    return result, nil
}
