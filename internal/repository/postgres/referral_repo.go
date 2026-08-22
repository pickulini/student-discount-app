package postgres

import (
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type ReferralRepo struct {
    db *DB
}

func NewReferralRepo(db *DB) repository.ReferralRepository {
    return &ReferralRepo{db: db}
}

func (r *ReferralRepo) CreateInvite(ctx context.Context, invite *domain.ReferralInvite) error {
    query := `INSERT INTO referral_invites (referrer_id, referred_user_id, status) 
              VALUES ($1, $2, $3) RETURNING id, created_at`
    err := r.db.Pool.QueryRow(ctx, query,
        invite.ReferrerID, invite.ReferredUserID, invite.Status,
    ).Scan(&invite.ID, &invite.CreatedAt)
    return err
}

func (r *ReferralRepo) GetInvitesByReferrer(ctx context.Context, referrerID int64) ([]domain.ReferralInvite, error) {
    query := `SELECT id, referrer_id, referred_user_id, status, created_at 
              FROM referral_invites WHERE referrer_id = $1`
    rows, err := r.db.Pool.Query(ctx, query, referrerID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var invites []domain.ReferralInvite
    for rows.Next() {
        var inv domain.ReferralInvite
        if err := rows.Scan(&inv.ID, &inv.ReferrerID, &inv.ReferredUserID, &inv.Status, &inv.CreatedAt); err != nil {
            return nil, err
        }
        invites = append(invites, inv)
    }
    return invites, nil
}

func (r *ReferralRepo) GetInvitesCountByReferrer(ctx context.Context, referrerID int64) (int, error) {
    query := `SELECT COUNT(*) FROM referral_invites WHERE referrer_id = $1`
    var count int
    err := r.db.Pool.QueryRow(ctx, query, referrerID).Scan(&count)
    return count, err
}

func (r *ReferralRepo) CreateReward(ctx context.Context, reward *domain.ReferralReward) error {
    query := `INSERT INTO referral_rewards (referrer_id, referred_user_id, amount, status, trigger_type) 
              VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`
    err := r.db.Pool.QueryRow(ctx, query,
        reward.ReferrerID, reward.ReferredUserID, reward.Amount, reward.Status, reward.TriggerType,
    ).Scan(&reward.ID, &reward.CreatedAt)
    return err
}

func (r *ReferralRepo) GetRewardsByReferrer(ctx context.Context, referrerID int64) ([]domain.ReferralReward, error) {
    query := `SELECT id, referrer_id, referred_user_id, amount, status, trigger_type, created_at, credited_at 
              FROM referral_rewards WHERE referrer_id = $1`
    rows, err := r.db.Pool.Query(ctx, query, referrerID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var rewards []domain.ReferralReward
    for rows.Next() {
        var rw domain.ReferralReward
        if err := rows.Scan(&rw.ID, &rw.ReferrerID, &rw.ReferredUserID, &rw.Amount, &rw.Status, &rw.TriggerType, &rw.CreatedAt, &rw.CreditedAt); err != nil {
            return nil, err
        }
        rewards = append(rewards, rw)
    }
    return rewards, nil
}

func (r *ReferralRepo) UpdateInviteStatus(ctx context.Context, referredUserID int64, status string) error {
    query := `UPDATE referral_invites SET status = $1 WHERE referred_user_id = $2`
    _, err := r.db.Pool.Exec(ctx, query, status, referredUserID)
    return err
}
