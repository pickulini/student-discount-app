package worker

import (
    "context"
    "log"
    "strings"
    "time"

    "your-project/internal/domain"
    "your-project/internal/repository/postgres"
    "your-project/internal/usecase"
)

// Напоминаем участникам за 2 часа до начала ивента (с учётом повторений).
const eventReminderLead = 2 * time.Hour

// StartEventReminderWorker раз в минуту ищет ивенты, которые начнутся примерно
// через 2 часа, и шлёт уведомление тем, кто идёт.
func StartEventReminderWorker(ctx context.Context, repo *postgres.CabinetRepo, notif *usecase.NotificationUsecase) {
    log.Println("[EVENT_REMINDER] start")
    go func() {
        ticker := time.NewTicker(time.Minute)
        defer ticker.Stop()
        for {
            runEventReminders(ctx, repo, notif)
            select {
            case <-ticker.C:
            case <-ctx.Done():
                return
            }
        }
    }()
}

// nextOccurrence — ближайшее начало ивента не раньше from (FREQ=DAILY|WEEKLY|MONTHLY).
func nextOccurrence(start time.Time, rule string, until *time.Time, from time.Time) (time.Time, bool) {
    if rule == "" || !start.Before(from) {
        return start, true
    }
    t := start
    for i := 0; i < 2000 && t.Before(from); i++ {
        switch {
        case strings.Contains(rule, "FREQ=DAILY"):
            t = t.AddDate(0, 0, 1)
        case strings.Contains(rule, "FREQ=WEEKLY"):
            t = t.AddDate(0, 0, 7)
        case strings.Contains(rule, "FREQ=MONTHLY"):
            t = t.AddDate(0, 1, 0)
        default:
            return start, false
        }
    }
    if until != nil && t.After(*until) {
        return t, false
    }
    return t, true
}

func runEventReminders(ctx context.Context, repo *postgres.CabinetRepo, notif *usecase.NotificationUsecase) {
    now := time.Now()
    from := now.Add(eventReminderLead - 5*time.Minute)
    to := now.Add(eventReminderLead + time.Minute)
    list, err := repo.ReminderCandidates(ctx, from, to)
    if err != nil {
        log.Printf("[EVENT_REMINDER] query error: %v", err)
        return
    }
    msk := time.FixedZone("MSK", 3*3600)
    for _, c := range list {
        at, ok := nextOccurrence(c.StartAt, c.RecurrenceRule, c.RecurrenceUntil, from)
        if !ok || at.Before(from) || !at.Before(to) {
            continue
        }
        if repo.ReminderSent(ctx, c.UserID, c.EventID) {
            continue
        }
        body := "Начало в " + at.In(msk).Format("15:04")
        if c.Address != "" {
            body += " · " + c.Address
        }
        id := c.EventID
        _ = notif.Create(ctx, usecase.CreateNotificationInput{
            UserID:        c.UserID,
            Type:          domain.NotifEventReminder,
            Title:         "Через 2 часа: " + c.Title,
            Body:          body,
            Link:          "/events/" + itoa(id),
            ReferenceType: "event",
            ReferenceID:   &id,
        })
    }
}

func itoa(v int64) string {
    if v == 0 {
        return "0"
    }
    neg := v < 0
    if neg {
        v = -v
    }
    b := []byte{}
    for v > 0 {
        b = append([]byte{byte('0' + v%10)}, b...)
        v /= 10
    }
    if neg {
        b = append([]byte{'-'}, b...)
    }
    return string(b)
}
