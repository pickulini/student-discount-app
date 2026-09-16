package postgres

import (
    "context"
    "database/sql"
    "log"
    "time"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type StudentVerificationRepo struct {
    db *DB
}

func NewStudentVerificationRepo(db *DB) repository.StudentVerificationRepository {
    return &StudentVerificationRepo{db: db}
}

func (r *StudentVerificationRepo) Create(ctx context.Context, v *domain.StudentVerification) error {
    query := `INSERT INTO student_verifications (user_id, method, status, university_id, student_identifier, document_key) 
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at, updated_at`
    err := r.db.Pool.QueryRow(ctx, query,
        v.UserID, v.Method, v.Status, v.UniversityID, v.StudentIdentifier, v.DocumentKey,
    ).Scan(&v.ID, &v.CreatedAt, &v.UpdatedAt)
    return err
}

func (r *StudentVerificationRepo) GetByUserID(ctx context.Context, userID int64) (*domain.StudentVerification, error) {
    query := `SELECT id, user_id, method, status, university_id, student_identifier, document_key, verified_by, verified_at, expires_at, rejection_reason, created_at, updated_at 
              FROM student_verifications WHERE user_id = $1 ORDER BY id DESC LIMIT 1`
    var v domain.StudentVerification
    var verifiedBy sql.NullInt64
    var verifiedAt, expiresAt sql.NullTime
    err := r.db.Pool.QueryRow(ctx, query, userID).Scan(
        &v.ID, &v.UserID, &v.Method, &v.Status, &v.UniversityID,
        &v.StudentIdentifier, &v.DocumentKey, &verifiedBy, &verifiedAt,
        &expiresAt, &v.RejectionReason, &v.CreatedAt, &v.UpdatedAt,
    )
    if err != nil {
        return nil, err
    }
    if verifiedBy.Valid {
        v.VerifiedBy = &verifiedBy.Int64
    }
    if verifiedAt.Valid {
        v.VerifiedAt = &verifiedAt.Time
    }
    if expiresAt.Valid {
        v.ExpiresAt = &expiresAt.Time
    }
    return &v, nil
}

func (r *StudentVerificationRepo) GetByID(ctx context.Context, id int64) (*domain.StudentVerification, error) {
    query := `SELECT id, user_id, method, status, university_id, student_identifier, document_key, verified_by, verified_at, expires_at, rejection_reason, created_at, updated_at 
              FROM student_verifications WHERE id = $1`
    var v domain.StudentVerification
    var verifiedBy sql.NullInt64
    var verifiedAt, expiresAt sql.NullTime
    err := r.db.Pool.QueryRow(ctx, query, id).Scan(
        &v.ID, &v.UserID, &v.Method, &v.Status, &v.UniversityID,
        &v.StudentIdentifier, &v.DocumentKey, &verifiedBy, &verifiedAt,
        &expiresAt, &v.RejectionReason, &v.CreatedAt, &v.UpdatedAt,
    )
    if err != nil {
        return nil, err
    }
    if verifiedBy.Valid {
        v.VerifiedBy = &verifiedBy.Int64
    }
    if verifiedAt.Valid {
        v.VerifiedAt = &verifiedAt.Time
    }
    if expiresAt.Valid {
        v.ExpiresAt = &expiresAt.Time
    }
    return &v, nil
}

func (r *StudentVerificationRepo) List(ctx context.Context, limit, offset int) ([]domain.StudentVerification, error) {
    query := `SELECT id, user_id, method, status, university_id, student_identifier, document_key, created_at, updated_at 
              FROM student_verifications ORDER BY id LIMIT $1 OFFSET $2`
    rows, err := r.db.Pool.Query(ctx, query, limit, offset)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var verifications []domain.StudentVerification
    for rows.Next() {
        var v domain.StudentVerification
        var universityID sql.NullInt64
        var studentIdentifier, documentKey sql.NullString
        if err := rows.Scan(&v.ID, &v.UserID, &v.Method, &v.Status, &universityID,
            &studentIdentifier, &documentKey, &v.CreatedAt, &v.UpdatedAt); err != nil {
            return nil, err
        }
        if universityID.Valid {
            v.UniversityID = &universityID.Int64
        }
        if studentIdentifier.Valid {
            v.StudentIdentifier = studentIdentifier.String
        }
        if documentKey.Valid {
            v.DocumentKey = documentKey.String
        }
        verifications = append(verifications, v)
    }
    return verifications, nil
}

func (r *StudentVerificationRepo) UpdateStatus(ctx context.Context, id int64, status string, verifiedBy int64, rejectionReason string) error {
    query := `UPDATE student_verifications SET status=$1, verified_by=$2, verified_at=NOW(), rejection_reason=$3, updated_at=NOW() WHERE id=$4`
    _, err := r.db.Pool.Exec(ctx, query, status, verifiedBy, rejectionReason, id)
    if err != nil {
        return err
    }
    // Закрываем все остальные pending заявки этого пользователя
    var userID int64
    err = r.db.Pool.QueryRow(ctx, `SELECT user_id FROM student_verifications WHERE id=$1`, id).Scan(&userID)
    if err != nil {
        return err
    }
    _, err = r.db.Pool.Exec(ctx, `UPDATE student_verifications SET status=$1, updated_at=NOW() WHERE user_id=$2 AND id!=$3 AND status='pending'`, status, userID, id)
    if err != nil {
        return err
    }
    var userStatus string
    if status == "verified" {
        userStatus = "verified"
    } else if status == "rejected" {
        userStatus = "rejected"
    } else {
        return nil
    }
    _, err = r.db.Pool.Exec(ctx, `UPDATE users SET student_status=$1, updated_at=NOW() WHERE id=$2`, userStatus, userID)
    return err
}

func (r *StudentVerificationRepo) Update(ctx context.Context, v *domain.StudentVerification) error {
    query := `UPDATE student_verifications SET method=$1, status=$2, university_id=$3, student_identifier=$4, document_key=$5, updated_at=NOW() WHERE id=$6`
    _, err := r.db.Pool.Exec(ctx, query, v.Method, v.Status, v.UniversityID, v.StudentIdentifier, v.DocumentKey, v.ID)
    return err
}

func (r *StudentVerificationRepo) SetExpiresAt(ctx context.Context, id int64, expiresAt time.Time) error {
    query := `UPDATE student_verifications SET expires_at = $1, updated_at = NOW() WHERE id = $2`
    _, err := r.db.Pool.Exec(ctx, query, expiresAt, id)
    return err
}

// ExpireOldVerifications переводит истёкшие верификации в статус expired
// и обновляет student_status пользователей
func (r *StudentVerificationRepo) ExpireOldVerifications(ctx context.Context) (int, error) {
    // Обновляем верификации
    query := `
        UPDATE student_verifications
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'verified' AND expires_at IS NOT NULL AND expires_at < NOW()
        RETURNING user_id
    `
    rows, err := r.db.Pool.Query(ctx, query)
    if err != nil {
        return 0, err
    }
    defer rows.Close()

    var userIDs []int64
    for rows.Next() {
        var uid int64
        if err := rows.Scan(&uid); err != nil {
            return 0, err
        }
        userIDs = append(userIDs, uid)
    }

    // Обновляем статус пользователей
    for _, uid := range userIDs {
        _, err := r.db.Pool.Exec(ctx,
            `UPDATE users SET student_status = 'expired', updated_at = NOW() WHERE id = $1`,
            uid,
        )
        if err != nil {
            log.Printf("Failed to update user %d status to expired: %v", uid, err)
        }
    }

    return len(userIDs), nil
}
