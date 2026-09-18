package domain

import "time"

type Friendship struct {
    ID          int64     `json:"id"`
    RequesterID int64     `json:"requester_id"`
    AddresseeID int64     `json:"addressee_id"`
    Status      string    `json:"status"` // pending, accepted, rejected, cancelled
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

// Публичная карточка пользователя для поиска и списка друзей
type UserPublicCard struct {
	ID           int64   `json:"id"`
	FriendshipID *int64  `json:"friendship_id,omitempty"`
	Nickname     *string `json:"nickname,omitempty"`
	Username     *string `json:"username,omitempty"`
	FullName     string  `json:"full_name"`
	AvatarURL    *string `json:"avatar_url,omitempty"`
	University   *string `json:"university,omitempty"`
}

// Статус дружбы между текущим пользователем и другим
type FriendStatusResponse struct {
    UserID  int64  `json:"user_id"`
    Status  string `json:"status"` // none, pending_outgoing, pending_incoming, friends
    FriendshipID *int64 `json:"friendship_id,omitempty"`
}
