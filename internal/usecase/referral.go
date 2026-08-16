package usecase

import (
    "context"
    "log"
    "your-project/internal/repository"
)

type ReferralUsecase struct {
    referralRepo repository.ReferralRepository
    userRepo     repository.UserRepository
}

func NewReferralUsecase(
    referralRepo repository.ReferralRepository,
    userRepo repository.UserRepository,
) *ReferralUsecase {
    return &ReferralUsecase{
        referralRepo: referralRepo,
        userRepo:     userRepo,
    }
}

type ReferralStats struct {
    TotalInvites int     `json:"total_invites"`
    Active       int     `json:"active"`
    BonusTotal   float64 `json:"bonus_total"`
}

func (u *ReferralUsecase) GetStats(ctx context.Context, userID int64) (*ReferralStats, error) {
    total, err := u.referralRepo.GetInvitesCountByReferrer(ctx, userID)
    if err != nil {
        log.Printf("GetInvitesCountByReferrer error: %v", err)
        return nil, err
    }
    invites, err := u.referralRepo.GetInvitesByReferrer(ctx, userID)
    if err != nil {
        log.Printf("GetInvitesByReferrer error: %v", err)
        return nil, err
    }
    active := 0
    for _, inv := range invites {
        if inv.Status == "accepted" {
            active++
        }
    }
    rewards, err := u.referralRepo.GetRewardsByReferrer(ctx, userID)
    if err != nil {
        log.Printf("GetRewardsByReferrer error: %v", err)
        return nil, err
    }
    bonusTotal := 0.0
    for _, rw := range rewards {
        if rw.Status == "credited" {
            bonusTotal += rw.Amount
        }
    }
    log.Printf("Stats for user %d: totalInvites=%d, active=%d, bonusTotal=%f", userID, total, active, bonusTotal)
    return &ReferralStats{
        TotalInvites: total,
        Active:       active,
        BonusTotal:   bonusTotal,
    }, nil
}

func (u *ReferralUsecase) GetReferralCode(ctx context.Context, userID int64) (string, error) {
    user, err := u.userRepo.GetByID(ctx, userID)
    if err != nil {
        return "", err
    }
    return user.ReferralCode, nil
}
