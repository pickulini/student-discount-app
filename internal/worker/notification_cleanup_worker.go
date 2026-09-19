package worker

import (
    "context"
    "log"
    "time"

    "your-project/internal/repository"
)

// StartNotificationCleanupWorker удаляет уведомления старше 60 дней раз в сутки.
func StartNotificationCleanupWorker(ctx context.Context, notifRepo repository.NotificationRepository) {
    log.Println("[NOTIF_CLEANUP] start")
    go func() {
        runCleanup(ctx, notifRepo)

        ticker := time.NewTicker(24 * time.Hour)
        defer ticker.Stop()
        for {
            select {
            case <-ticker.C:
                runCleanup(ctx, notifRepo)
            case <-ctx.Done():
                return
            }
        }
    }()
}

func runCleanup(ctx context.Context, notifRepo repository.NotificationRepository) {
    n, err := notifRepo.DeleteOld(ctx, 60)
    if err != nil {
        log.Printf("[NOTIF_CLEANUP] error: %v", err)
        return
    }
    if n > 0 {
        log.Printf("[NOTIF_CLEANUP] removed %d old notifications", n)
    }
}
