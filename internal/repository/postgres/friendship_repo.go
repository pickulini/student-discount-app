package postgres

import (
    "context"
    "database/sql"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type FriendshipRepo struct {
    db *DB
}

func NewFriendshipRepo(db *DB) repository.FriendshipRepository {
    return &FriendshipRepo{db: db}
}

func (r *FriendshipRepo) Create(ctx context.Context, requesterID, addresseeID int64) (*domain.Friendship, error) {
    query := `INSERT INTO friendships (requester_id, addressee_id, status)
              VALUES ($1, $2, 'pending')
              RETURNING id, requester_id, addressee_id, status, created_at, updated_at`
    var f domain.Friendship
    err := r.db.Pool.QueryRow(ctx, query, requesterID, addresseeID).Scan(
        &f.ID, &f.RequesterID, &f.AddresseeID, &f.Status, &f.CreatedAt, &f.UpdatedAt,
    )
    if err != nil {
        return nil, err
    }
    return &f, nil
}

func (r *FriendshipRepo) GetByID(ctx context.Context, id int64) (*domain.Friendship, error) {
	query := `SELECT id, requester_id, addressee_id, status, created_at, updated_at
	          FROM friendships WHERE id = $1`
	var f domain.Friendship
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&f.ID, &f.RequesterID, &f.AddresseeID, &f.Status, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *FriendshipRepo) GetBetween(ctx context.Context, userA, userB int64) (*domain.Friendship, error) {
    query := `SELECT id, requester_id, addressee_id, status, created_at, updated_at
              FROM friendships
              WHERE (requester_id = $1 AND addressee_id = $2)
                 OR (requester_id = $2 AND addressee_id = $1)
              ORDER BY id DESC LIMIT 1`
    var f domain.Friendship
    err := r.db.Pool.QueryRow(ctx, query, userA, userB).Scan(
        &f.ID, &f.RequesterID, &f.AddresseeID, &f.Status, &f.CreatedAt, &f.UpdatedAt,
    )
    if err != nil {
        return nil, err
    }
    return &f, nil
}

func (r *FriendshipRepo) UpdateStatus(ctx context.Context, id int64, status string) error {
    query := `UPDATE friendships SET status = $1, updated_at = NOW() WHERE id = $2`
    _, err := r.db.Pool.Exec(ctx, query, status, id)
    return err
}

func (r *FriendshipRepo) Delete(ctx context.Context, id int64) error {
    query := `DELETE FROM friendships WHERE id = $1`
    _, err := r.db.Pool.Exec(ctx, query, id)
    return err
}

// helper для сканирования публичной карточки
func scanUserCard(rows interface{ Scan(...interface{}) error }) (domain.UserPublicCard, error) {
	var c domain.UserPublicCard
	var friendshipID sql.NullInt64
	var nickname, username, avatarURL, university sql.NullString

	if err := rows.Scan(&c.ID, &friendshipID, &nickname, &username, &c.FullName, &avatarURL, &university); err != nil {
		return c, err
	}
	if friendshipID.Valid {
		c.FriendshipID = &friendshipID.Int64
	}
	if nickname.Valid {
		c.Nickname = &nickname.String
	}
	if username.Valid {
		c.Username = &username.String
	}
	if avatarURL.Valid {
		c.AvatarURL = &avatarURL.String
	}
	if university.Valid {
		c.University = &university.String
	}
	return c, nil
}

func (r *FriendshipRepo) ListFriends(ctx context.Context, userID int64) ([]domain.UserPublicCard, error) {
    query := `
        SELECT u.id, NULL::bigint, u.nickname, u.username, u.full_name, u.avatar_url, un.name
        FROM friendships f
        JOIN users u ON (u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END)
        LEFT JOIN universities un ON un.id = u.university_id
        WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
        ORDER BY u.nickname NULLS LAST, u.full_name`
    rows, err := r.db.Pool.Query(ctx, query, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    friends := make([]domain.UserPublicCard, 0)
    for rows.Next() {
        c, err := scanUserCard(rows)
        if err != nil {
            return nil, err
        }
        friends = append(friends, c)
    }
    return friends, nil
}

func (r *FriendshipRepo) ListIncomingRequests(ctx context.Context, userID int64) ([]domain.UserPublicCard, error) {
    query := `
        SELECT u.id, f.id, u.nickname, u.username, u.full_name, u.avatar_url, un.name
        FROM friendships f
        JOIN users u ON u.id = f.requester_id
        LEFT JOIN universities un ON un.id = u.university_id
        WHERE f.addressee_id = $1 AND f.status = 'pending'
        ORDER BY f.created_at DESC`
    rows, err := r.db.Pool.Query(ctx, query, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    result := make([]domain.UserPublicCard, 0)
    for rows.Next() {
        c, err := scanUserCard(rows)
        if err != nil {
            return nil, err
        }
        result = append(result, c)
    }
    return result, nil
}

func (r *FriendshipRepo) ListOutgoingRequests(ctx context.Context, userID int64) ([]domain.UserPublicCard, error) {
    query := `
        SELECT u.id, f.id, u.nickname, u.username, u.full_name, u.avatar_url, un.name
        FROM friendships f
        JOIN users u ON u.id = f.addressee_id
        LEFT JOIN universities un ON un.id = u.university_id
        WHERE f.requester_id = $1 AND f.status = 'pending'
        ORDER BY f.created_at DESC`
    rows, err := r.db.Pool.Query(ctx, query, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    result := make([]domain.UserPublicCard, 0)
    for rows.Next() {
        c, err := scanUserCard(rows)
        if err != nil {
            return nil, err
        }
        result = append(result, c)
    }
    return result, nil
}

func (r *FriendshipRepo) CountIncomingRequests(ctx context.Context, userID int64) (int, error) {
    query := `SELECT COUNT(*) FROM friendships WHERE addressee_id = $1 AND status = 'pending'`
    var count int
    err := r.db.Pool.QueryRow(ctx, query, userID).Scan(&count)
    return count, err
}
