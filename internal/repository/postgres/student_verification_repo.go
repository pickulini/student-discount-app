package postgres

import (
    "context"
    "database/sql"
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
    var universityID sql.NullInt64
    var studentIdentifier, documentKey, rejectionReason sql.NullString
    var verifiedBy sql.NullInt64
    var verifiedAt, expiresAt sql.NullTime
    err := r.db.Pool.QueryRow(ctx, query, userID).Scan(
        &v.ID, &v.UserID, &v.Method, &v.Status, &universityID,
        &studentIdentifier, &documentKey, &verifiedBy, &verifiedAt,
        &expiresAt, &rejectionReason, &v.CreatedAt, &v.UpdatedAt,
    )
    if err != nil {
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
    if verifiedBy.Valid {
        v.VerifiedBy = &verifiedBy.Int64
    }
    if verifiedAt.Valid {
        v.VerifiedAt = &verifiedAt.Time
    }
    if expiresAt.Valid {
        v.ExpiresAt = &expiresAt.Time
    }
    if rejectionReason.Valid {
        v.RejectionReason = rejectionReason.String
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
    // Обновляем целевую запись
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

    // Обновляем все другие записи с тем же user_id (кроме только что обновлённой)
    _, err = r.db.Pool.Exec(ctx, `UPDATE student_verifications SET status=$1, updated_at=NOW() WHERE user_id=$2 AND id!=$3 AND status='pending'`, status, userID, id)
    if err != nil {
        return err
    }

    // Обновляем статус студента в users
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
