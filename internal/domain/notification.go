package domain

import "time"

type Notification struct {
    ID            int64      `json:"id"`
    UserID        int64      `json:"user_id"`
    Type          string     `json:"type"`
    Category      string     `json:"category"`
    Title         string     `json:"title"`
    Body          *string    `json:"body,omitempty"`
    Link          *string    `json:"link,omitempty"`
    ActorID       *int64     `json:"actor_id,omitempty"`
    ActorName     *string    `json:"actor_name,omitempty"`     // для UI
    ActorUsername *string    `json:"actor_username,omitempty"` // для UI
    ActorAvatar   *string    `json:"actor_avatar,omitempty"`
    ReferenceType *string    `json:"reference_type,omitempty"`
    ReferenceID   *int64     `json:"reference_id,omitempty"`
    ReadAt        *time.Time `json:"read_at,omitempty"`
    CreatedAt     time.Time  `json:"created_at"`
}

// Типы уведомлений
const (
    NotifFriendRequest    = "friend_request"
    NotifFriendAccepted   = "friend_accepted"
    NotifNewEvent         = "new_event"
    NotifFriendGoing      = "friend_going"
    NotifNewOffer         = "new_offer"
    NotifOrderPaid        = "order_paid"
    NotifOrderRefunded    = "order_refunded"
    NotifVerificationDone = "verification_done"
)

// Категории (для настроек)
const (
    NotifCategoryFriends = "friends"
    NotifCategoryEvents  = "events"
    NotifCategoryOffers  = "offers"
    NotifCategorySystem  = "system"
)

func NotificationCategoryByType(t string) string {
    switch t {
    case NotifFriendRequest, NotifFriendAccepted:
        return NotifCategoryFriends
    case NotifNewEvent, NotifFriendGoing:
        return NotifCategoryEvents
    case NotifNewOffer:
        return NotifCategoryOffers
    default:
        return NotifCategorySystem
    }
}
