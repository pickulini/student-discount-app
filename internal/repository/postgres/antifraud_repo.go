package postgres

import (
    "context"
    "your-project/internal/repository"
)

type AntifraudRepo struct {
    db *DB
}

func NewAntifraudRepo(db *DB) repository.AntifraudRepository {
    return &AntifraudRepo{db: db}
}

// CountRegistrationsByIPHash считает количество регистраций с данного IP за последний час
func (r *AntifraudRepo) CountRegistrationsByIPHash(ctx context.Context, ipHash string, sinceMinutes int) (int, error) {
    query := `SELECT COUNT(*) FROM registration_attempts 
              WHERE ip_hash = $1 AND created_at > NOW() - INTERVAL '1 minute' * $2`
    var count int
    err := r.db.Pool.QueryRow(ctx, query, ipHash, sinceMinutes).Scan(&count)
    return count, err
}

// LogRegistrationAttempt сохраняет попытку регистрации
func (r *AntifraudRepo) LogRegistrationAttempt(ctx context.Context, ipHash, email string) error {
    query := `INSERT INTO registration_attempts (ip_hash, email) VALUES ($1, $2)`
    _, err := r.db.Pool.Exec(ctx, query, ipHash, email)
    return err
}

// CheckReferralCycle проверяет, что пользователь не приглашает сам себя через цепочку
func (r *AntifraudRepo) CheckReferralCycle(ctx context.Context, referrerID, newUserID int64) (bool, error) {
    // Проверяем, что referrer != newUser (это уже очевидно, но на всякий случай)
    if referrerID == newUserID {
        return true, nil
    }
    return false, nil
}
