package worker

import (
    "context"
    "log"
    "time"

    "your-project/internal/domain"
    "your-project/internal/repository"
)

// StartBonusCreditWorker раз в 30 минут зачисляет реферальные награды,
// у которых истёк refund window (available_at <= NOW()).
func StartBonusCreditWorker(
    ctx context.Context,
    referralRepo repository.ReferralRepository,
    bonusRepo repository.BonusRepository,
) {
    log.Println("[BONUS_WORKER] start")
    go func() {
        // первый прогон сразу
        runBonusCredit(ctx, referralRepo, bonusRepo)

        ticker := time.NewTicker(30 * time.Minute)
        defer ticker.Stop()
        for {
            select {
            case <-ticker.C:
                runBonusCredit(ctx, referralRepo, bonusRepo)
            case <-ctx.Done():
                log.Println("[BONUS_WORKER] stopped")
                return
            }
        }
    }()
}

func runBonusCredit(
    ctx context.Context,
    referralRepo repository.ReferralRepository,
    bonusRepo repository.BonusRepository,
) {
    rewards, err := referralRepo.ListPendingAvailable(ctx)
    if err != nil {
        log.Printf("[BONUS_WORKER] list error: %v", err)
        return
    }
    if len(rewards) == 0 {
        return
    }
    log.Printf("[BONUS_WORKER] found %d rewards to credit", len(rewards))

    for _, rw := range rewards {
        if err := creditReward(ctx, rw, referralRepo, bonusRepo); err != nil {
            log.Printf("[BONUS_WORKER] failed to credit reward %d: %v", rw.ID, err)
            continue
        }
        log.Printf("[BONUS_WORKER] credited reward %d (referrer=%d amount=%.2f)",
            rw.ID, rw.ReferrerID, rw.Amount)
    }
}

func creditReward(
    ctx context.Context,
    rw domain.ReferralReward,
    referralRepo repository.ReferralRepository,
    bonusRepo repository.BonusRepository,
) error {
    // 1. Получаем бонусный счёт
    bonusAcc, err := bonusRepo.GetByUserID(ctx, rw.ReferrerID)
    if err != nil {
        return err
    }

    // 2. Создаём транзакцию
    bonusTx := &domain.BonusTransaction{
        UserID:        rw.ReferrerID,
        Amount:        rw.Amount,
        Type:          "referral_reward",
        ReferenceType: "referral_reward",
        ReferenceID:   rw.ID,
    }
    if err := bonusRepo.CreateTransaction(ctx, bonusTx); err != nil {
        return err
    }

    // 3. Обновляем баланс
    newBalance := bonusAcc.Balance + rw.Amount
    if err := bonusRepo.UpdateBalance(ctx, bonusAcc.ID, newBalance); err != nil {
        return err
    }

    // 4. Помечаем reward как credited
    return referralRepo.MarkCredited(ctx, rw.ID)
}
