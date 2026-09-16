package worker

import (
    "context"
    "log"
    "time"
    "your-project/internal/repository"
)

func StartVerificationExpiryWorker(ctx context.Context, verificationRepo repository.StudentVerificationRepository) {
    log.Println("[WORKER] StartVerificationExpiryWorker called")
    go func() {
        log.Println("[WORKER] goroutine started")
        runExpiryCheck(ctx, verificationRepo)

        for {
            now := time.Now().UTC()
            nextRun := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.UTC)
            duration := time.Until(nextRun)
            log.Printf("[WORKER] next run in %v", duration)

            select {
            case <-time.After(duration):
                runExpiryCheck(ctx, verificationRepo)
            case <-ctx.Done():
                log.Println("[WORKER] stopped")
                return
            }
        }
    }()
}

func runExpiryCheck(ctx context.Context, verificationRepo repository.StudentVerificationRepository) {
    log.Println("[WORKER] running expiry check...")
    count, err := verificationRepo.ExpireOldVerifications(ctx)
    if err != nil {
        log.Printf("[WORKER] error: %v", err)
        return
    }
    log.Printf("[WORKER] expired %d verifications", count)
}
