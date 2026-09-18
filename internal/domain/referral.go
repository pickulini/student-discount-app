package domain

import "time"

type ReferralInvite struct {
    ID             int64     `json:"id"`
    ReferrerID     int64     `json:"referrer_id"`
    ReferredUserID int64     `json:"referred_user_id"`
    Status         string    `json:"status"` // pending, accepted, completed
    CreatedAt      time.Time `json:"created_at"`
}

type ReferralReward struct {
    ID             int64      `json:"id"`
    ReferrerID     int64      `json:"referrer_id"`
    ReferredUserID int64      `json:"referred_user_id"`
    Amount         float64    `json:"amount"`
    Status         string     `json:"status"` // pending, approved, credited, cancelled
    TriggerType    string     `json:"trigger_type"` // registration, first_purchase, verification, qualifying_action
    CreatedAt      time.Time  `json:"created_at"`
    AvailableAt    *time.Time `json:"available_at,omitempty"` // когда можно зачислить
    CreditedAt     *time.Time `json:"credited_at,omitempty"`
    CancelledAt    *time.Time `json:"cancelled_at,omitempty"`
}
