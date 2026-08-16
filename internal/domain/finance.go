package domain

import "time"

type Account struct {
    ID        int64     `json:"id"`
    UserID    int64     `json:"user_id"`
    Type      string    `json:"type"` // cash, bonus
    Currency  string    `json:"currency"`
    Balance   float64   `json:"balance"`
    Status    string    `json:"status"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type LedgerTransaction struct {
    ID             int64      `json:"id"`
    Type           string     `json:"type"` // deposit, purchase, refund, adjustment, settlement
    Status         string     `json:"status"`
    IdempotencyKey string     `json:"idempotency_key"`
    ReferenceType  string     `json:"reference_type"`
    ReferenceID    int64      `json:"reference_id"`
    Description    string     `json:"description"`
    CreatedAt      time.Time  `json:"created_at"`
    CompletedAt    *time.Time `json:"completed_at"`
}

type LedgerEntry struct {
    ID            int64     `json:"id"`
    TransactionID int64     `json:"transaction_id"`
    AccountID     int64     `json:"account_id"`
    Amount        float64   `json:"amount"` // положительное = кредит, отрицательное = дебет
    CreatedAt     time.Time `json:"created_at"`
}

type BonusAccount struct {
    ID        int64     `json:"id"`
    UserID    int64     `json:"user_id"`
    Balance   float64   `json:"balance"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type BonusTransaction struct {
    ID            int64      `json:"id"`
    UserID        int64      `json:"user_id"`
    Amount        float64    `json:"amount"`
    Type          string     `json:"type"` // referral_reward, achievement, promotion, purchase_bonus, manual_adjustment, expiration, spend, refund
    ReferenceType string     `json:"reference_type"`
    ReferenceID   int64      `json:"reference_id"`
    ExpiresAt     *time.Time `json:"expires_at"`
    CreatedAt     time.Time  `json:"created_at"`
}
