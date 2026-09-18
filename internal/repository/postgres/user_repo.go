package postgres

import (
    "context"
	"database/sql"
    "errors"
    "github.com/jackc/pgx/v5"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type UserRepo struct {
    db *DB
}

func NewUserRepo(db *DB) repository.UserRepository {
    return &UserRepo{db: db}
}

func (r *UserRepo) Create(ctx context.Context, user *domain.User) error {
    query := `INSERT INTO users (email, password_hash, full_name, university_id, course, birth_date,
                     student_status, referral_code, referred_by, is_active, role) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              RETURNING id, created_at, updated_at`
    err := r.db.Pool.QueryRow(ctx, query,
        user.Email, user.PasswordHash, user.FullName,
        user.UniversityID, user.Course, user.BirthDate,
        user.StudentStatus, user.ReferralCode, user.ReferredBy,
        user.IsActive, user.Role,
    ).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
    return err
}

func (r *UserRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
    query := `SELECT id, email, password_hash, full_name, nickname, username, avatar_url, university_id, course, birth_date,
                     student_status, referral_code, referred_by, is_active, role, created_at, updated_at
              FROM users WHERE email = $1`
    var u domain.User
    err := r.db.Pool.QueryRow(ctx, query, email).Scan(
        &u.ID, &u.Email, &u.PasswordHash, &u.FullName,
        &u.Nickname, &u.Username, &u.AvatarURL,
        &u.UniversityID, &u.Course, &u.BirthDate,
        &u.StudentStatus, &u.ReferralCode, &u.ReferredBy,
        &u.IsActive, &u.Role, &u.CreatedAt, &u.UpdatedAt,
    )
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return nil, domain.ErrUserNotFound
        }
        return nil, err
    }
    return &u, nil
}

func (r *UserRepo) GetByID(ctx context.Context, id int64) (*domain.User, error) {
    query := `SELECT id, email, password_hash, full_name, nickname, username, avatar_url, university_id, course, birth_date,
                     student_status, referral_code, referred_by, is_active, role, created_at, updated_at
              FROM users WHERE id = $1`
    var u domain.User
    err := r.db.Pool.QueryRow(ctx, query, id).Scan(
        &u.ID, &u.Email, &u.PasswordHash, &u.FullName,
        &u.Nickname, &u.Username, &u.AvatarURL,
        &u.UniversityID, &u.Course, &u.BirthDate,
        &u.StudentStatus, &u.ReferralCode, &u.ReferredBy,
        &u.IsActive, &u.Role, &u.CreatedAt, &u.UpdatedAt,
    )
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return nil, domain.ErrUserNotFound
        }
        return nil, err
    }
    return &u, nil
}

func (r *UserRepo) GetByReferralCode(ctx context.Context, code string) (*domain.User, error) {
    query := `SELECT id, email, password_hash, full_name, nickname, username, avatar_url, university_id, course, birth_date,
                     student_status, referral_code, referred_by, is_active, role, created_at, updated_at
              FROM users WHERE referral_code = $1`
    var u domain.User
    err := r.db.Pool.QueryRow(ctx, query, code).Scan(
        &u.ID, &u.Email, &u.PasswordHash, &u.FullName,
        &u.Nickname, &u.Username, &u.AvatarURL,
        &u.UniversityID, &u.Course, &u.BirthDate,
        &u.StudentStatus, &u.ReferralCode, &u.ReferredBy,
        &u.IsActive, &u.Role, &u.CreatedAt, &u.UpdatedAt,
    )
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return nil, domain.ErrUserNotFound
        }
        return nil, err
    }
    return &u, nil
}

func (r *UserRepo) Update(ctx context.Context, user *domain.User) error {
    query := `UPDATE users SET email=$1, full_name=$2, university_id=$3, course=$4,
              birth_date=$5, student_status=$6, referral_code=$7, referred_by=$8,
              is_active=$9, role=$10, updated_at=NOW() WHERE id=$11`
    _, err := r.db.Pool.Exec(ctx, query,
        user.Email, user.FullName, user.UniversityID, user.Course,
        user.BirthDate, user.StudentStatus, user.ReferralCode, user.ReferredBy,
        user.IsActive, user.Role, user.ID,
    )
    return err
}

func (r *UserRepo) UpdateStudentStatus(ctx context.Context, userID int64, status string) error {
    query := `UPDATE users SET student_status=$1, updated_at=NOW() WHERE id=$2`
    _, err := r.db.Pool.Exec(ctx, query, status, userID)
    return err
}

func (r *UserRepo) UpdateBalance(ctx context.Context, userID int64, amount float64) error {
    // Баланс хранится в accounts, этот метод можно не использовать
    return nil
}

func (r *UserRepo) UpdateRole(ctx context.Context, userID int64, role string) error {
    query := `UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2`
    _, err := r.db.Pool.Exec(ctx, query, role, userID)
    return err
}

func (r *UserRepo) List(ctx context.Context, limit, offset int) ([]domain.User, error) {
    query := `SELECT id, email, password_hash, full_name, nickname, username, avatar_url, university_id, course, birth_date,
                     student_status, referral_code, referred_by, is_active, role, created_at, updated_at
              FROM users ORDER BY id LIMIT $1 OFFSET $2`
    rows, err := r.db.Pool.Query(ctx, query, limit, offset)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var users []domain.User
    for rows.Next() {
        var u domain.User
        if err := rows.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName,
            &u.UniversityID, &u.Course, &u.BirthDate,
            &u.StudentStatus, &u.ReferralCode, &u.ReferredBy,
            &u.IsActive, &u.Role, &u.CreatedAt, &u.UpdatedAt); err != nil {
            return nil, err
        }
        users = append(users, u)
    }
    return users, nil
}

func (r *UserRepo) GetByUsername(ctx context.Context, username string) (*domain.User, error) {
    query := `SELECT id, email, password_hash, full_name, nickname, username, avatar_url, university_id, course, birth_date,
                     student_status, referral_code, referred_by, is_active, role, created_at, updated_at
              FROM users WHERE LOWER(username) = LOWER($1)`
    var u domain.User
    err := r.db.Pool.QueryRow(ctx, query, username).Scan(
        &u.ID, &u.Email, &u.PasswordHash, &u.FullName,
        &u.Nickname, &u.Username, &u.AvatarURL,
        &u.UniversityID, &u.Course, &u.BirthDate,
        &u.StudentStatus, &u.ReferralCode, &u.ReferredBy,
        &u.IsActive, &u.Role, &u.CreatedAt, &u.UpdatedAt,
    )
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return nil, domain.ErrUserNotFound
        }
        return nil, err
    }
    return &u, nil
}

func (r *UserRepo) UpdateProfile(ctx context.Context, userID int64, nickname, username, avatarURL *string) error {
    query := `UPDATE users SET nickname = $1, username = $2, avatar_url = $3, updated_at = NOW() WHERE id = $4`
    _, err := r.db.Pool.Exec(ctx, query, nickname, username, avatarURL, userID)
    return err
}

func (r *UserRepo) SearchUsers(ctx context.Context, excludeID int64, query string, limit int) ([]domain.UserPublicCard, error) {
    query = "%" + query + "%"
    sqlQuery := `
        SELECT u.id, NULL::bigint, u.nickname, u.username, u.full_name, u.avatar_url, un.name
        FROM users u
        LEFT JOIN universities un ON un.id = u.university_id
        WHERE u.id <> $1
          AND (u.username ILIKE $2 OR u.nickname ILIKE $2 OR u.full_name ILIKE $2)
        ORDER BY u.username NULLS LAST, u.nickname NULLS LAST
        LIMIT $3`
    rows, err := r.db.Pool.Query(ctx, sqlQuery, excludeID, query, limit)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    result := make([]domain.UserPublicCard, 0)
    for rows.Next() {
        var c domain.UserPublicCard
        var friendshipID sql.NullInt64
        var nickname, username, avatarURL, university sql.NullString
        if err := rows.Scan(&c.ID, &friendshipID, &nickname, &username, &c.FullName, &avatarURL, &university); err != nil {
            return nil, err
        }
        if friendshipID.Valid { c.FriendshipID = &friendshipID.Int64 }
        if nickname.Valid { c.Nickname = &nickname.String }
        if username.Valid { c.Username = &username.String }
        if avatarURL.Valid { c.AvatarURL = &avatarURL.String }
        if university.Valid { c.University = &university.String }
        result = append(result, c)
    }
    return result, nil
}
