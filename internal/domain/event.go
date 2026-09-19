package domain

import "time"

// Участник ивента (RSVP + запись после оплаты)
type EventAttendee struct {
    ID        int64     `json:"id"`
    EventID   int64     `json:"event_id"`
    UserID    int64     `json:"user_id"`
    Status    string    `json:"status"` // going, interested, declined, cancelled
    OrderID   *int64    `json:"order_id,omitempty"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

// Уровни приватности ивента
const (
    EventPrivacyPublic      = "public"
    EventPrivacyFriends     = "friends"
    EventPrivacySubscribers = "subscribers"
    EventPrivacyUniversity  = "university"
    EventPrivacyInviteOnly  = "invite_only"
)

// Статусы участника
const (
    AttendeeGoing      = "going"
    AttendeeInterested = "interested"
    AttendeeDeclined   = "declined"
    AttendeeCancelled  = "cancelled"
)

func IsValidEventPrivacy(s string) bool {
    switch s {
    case EventPrivacyPublic, EventPrivacyFriends, EventPrivacySubscribers,
        EventPrivacyUniversity, EventPrivacyInviteOnly:
        return true
    }
    return false
}
