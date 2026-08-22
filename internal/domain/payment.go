package domain

import "time"

type Payment struct {
    ID               int64     `json:"id"`
    UserID           int64     `json:"user_id"`
    Amount           float64   `json:"amount"`
    Currency         string    `json:"currency"`
    Provider         string    `json:"provider"`
    ExternalPaymentID *string  `json:"external_payment_id,omitempty"`
    Status           string    `json:"status"` // pending, processing, succeeded, failed, cancelled, expired, refunded
    IdempotencyKey   string    `json:"idempotency_key"`
    PaymentURL       *string   `json:"payment_url,omitempty"`
    CreatedAt        time.Time `json:"created_at"`
    UpdatedAt        time.Time `json:"updated_at"`
    CompletedAt      *time.Time `json:"completed_at,omitempty"`
}
