package usecase

import (
    "context"
    "log"
    "time"

    "your-project/internal/domain"
    "your-project/internal/repository"
    "your-project/internal/sse"
)

type NotificationUsecase struct {
    notifRepo repository.NotificationRepository
    userRepo  repository.UserRepository
    hub       *sse.Hub
}

func NewNotificationUsecase(
    notifRepo repository.NotificationRepository,
    userRepo repository.UserRepository,
    hub *sse.Hub,
) *NotificationUsecase {
    return &NotificationUsecase{
        notifRepo: notifRepo,
        userRepo:  userRepo,
        hub:       hub,
    }
}

type CreateNotificationInput struct {
    UserID        int64
    Type          string
    Title         string
    Body          string
    Link          string
    ActorID       *int64
    ReferenceType string
    ReferenceID   *int64
}

// Create — создаёт уведомление, проверяет настройки юзера и пушит в SSE.
func (u *NotificationUsecase) Create(ctx context.Context, in CreateNotificationInput) error {
    if in.UserID == 0 || in.Type == "" || in.Title == "" {
        return nil
    }
    // Не отправляем самому себе
    if in.ActorID != nil && *in.ActorID == in.UserID {
        return nil
    }

    // Проверяем настройки
    user, err := u.userRepo.GetByID(ctx, in.UserID)
    if err != nil || user == nil {
        return nil
    }
    if !user.NotifyEnabled {
        return nil
    }
    category := domain.NotificationCategoryByType(in.Type)
    switch category {
    case domain.NotifCategoryFriends:
        if !user.NotifyFriends {
            return nil
        }
    case domain.NotifCategoryEvents:
        if !user.NotifyEvents {
            return nil
        }
    case domain.NotifCategoryOffers:
        if !user.NotifyOffers {
            return nil
        }
    case domain.NotifCategoryOrders:
        if !user.NotifyOrders {
            return nil
        }
    }

    n := &domain.Notification{
        UserID:   in.UserID,
        Type:     in.Type,
        Category: category,
        Title:    in.Title,
        ActorID:  in.ActorID,
    }
    if in.Body != "" {
        n.Body = &in.Body
    }
    if in.Link != "" {
        n.Link = &in.Link
    }
    if in.ReferenceType != "" {
        n.ReferenceType = &in.ReferenceType
    }
    if in.ReferenceID != nil {
        n.ReferenceID = in.ReferenceID
    }

    if err := u.notifRepo.Create(ctx, n); err != nil {
        log.Printf("[NOTIF] create error: %v", err)
        return err
    }

    // Подтянем actor-данные для SSE
    if in.ActorID != nil {
        if actor, err := u.userRepo.GetByID(ctx, *in.ActorID); err == nil && actor != nil {
            n.ActorName = actor.Nickname
            if n.ActorName == nil && actor.FullName != "" {
                n.ActorName = &actor.FullName
            }
            n.ActorUsername = actor.Username
            n.ActorAvatar = actor.AvatarURL
        }
    }

    // Тихие часы: уведомление сохраняется, но не прилетает в реальном времени.
    if user.NotifyQuiet && inQuietHours(time.Now()) {
        return nil
    }

    // Публикуем в SSE
    u.hub.Publish(in.UserID, n)

    return nil
}

func (u *NotificationUsecase) List(ctx context.Context, userID int64, limit, offset int) ([]domain.Notification, error) {
    return u.notifRepo.ListByUser(ctx, userID, limit, offset)
}

func (u *NotificationUsecase) CountUnread(ctx context.Context, userID int64) (int, error) {
    return u.notifRepo.CountUnread(ctx, userID)
}

func (u *NotificationUsecase) MarkRead(ctx context.Context, id, userID int64) error {
    return u.notifRepo.MarkRead(ctx, id, userID)
}

func (u *NotificationUsecase) MarkAllRead(ctx context.Context, userID int64) error {
    return u.notifRepo.MarkAllRead(ctx, userID)
}

func (u *NotificationUsecase) Hub() *sse.Hub {
    return u.hub
}

// ---- Настройки ----

type NotificationSettings struct {
    Enabled bool `json:"enabled"`
    Friends bool `json:"friends"`
    Events  bool `json:"events"`
    Offers  bool `json:"offers"`
    Orders  bool `json:"orders"`
    Quiet   bool `json:"quiet"`
}

var moscow = func() *time.Location {
    if l, err := time.LoadLocation("Europe/Moscow"); err == nil {
        return l
    }
    return time.FixedZone("MSK", 3*3600)
}()

// inQuietHours — 23:00–09:00 по Москве.
func inQuietHours(t time.Time) bool {
    h := t.In(moscow).Hour()
    return h >= 23 || h < 9
}

func (u *NotificationUsecase) GetUserForSettings(ctx context.Context, userID int64) (*NotificationSettings, error) {
    user, err := u.userRepo.GetByID(ctx, userID)
    if err != nil || user == nil {
        return nil, err
    }
    return &NotificationSettings{
        Enabled: user.NotifyEnabled,
        Friends: user.NotifyFriends,
        Events:  user.NotifyEvents,
        Offers:  user.NotifyOffers,
        Orders:  user.NotifyOrders,
        Quiet:   user.NotifyQuiet,
    }, nil
}

func (u *NotificationUsecase) UpdateSettings(ctx context.Context, userID int64, enabled, friends, events, offers, orders, quiet *bool) error {
    return u.userRepo.UpdateNotificationSettings(ctx, userID, enabled, friends, events, offers, orders, quiet)
}

func (u *NotificationUsecase) Delete(ctx context.Context, id, userID int64) error {
    return u.notifRepo.Delete(ctx, id, userID)
}

// NotifyAdmins — создаёт уведомление каждому админу.
func (u *NotificationUsecase) NotifyAdmins(ctx context.Context, in CreateNotificationInput) error {
    adminIDs, err := u.userRepo.ListAdminIDs(ctx)
    if err != nil {
        return err
    }
    for _, adminID := range adminIDs {
        copyIn := in
        copyIn.UserID = adminID
        _ = u.Create(ctx, copyIn)
    }
    return nil
}

// PublishSupportMessage — SSE-событие support_message владельцу обращения и всем админам.
func (u *NotificationUsecase) PublishSupportMessage(ctx context.Context, ownerID int64, payload interface{}) {
    if ownerID > 0 {
        u.hub.PublishToUser(ownerID, "support_message", payload)
    }
    if ids, err := u.userRepo.ListAdminIDs(ctx); err == nil {
        for _, id := range ids {
            if id != ownerID {
                u.hub.PublishToUser(id, "support_message", payload)
            }
        }
    }
}

// BroadcastAdminEvent — SSE-событие для админов (новая модерация и т.п.)
func (u *NotificationUsecase) BroadcastAdminEvent(eventType string, payload interface{}) {
    u.hub.Broadcast(eventType, payload)
}

func (u *NotificationUsecase) DeleteAllByUser(ctx context.Context, userID int64) error {
    return u.notifRepo.DeleteAllByUser(ctx, userID)
}

func (u *NotificationUsecase) ListUnread(ctx context.Context, userID int64) ([]domain.Notification, error) {
    return u.notifRepo.ListUnread(ctx, userID)
}
