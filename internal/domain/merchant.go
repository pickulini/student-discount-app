package domain

import "time"

type MerchantAccount struct {
    ID        int64     `json:"id"`
    CompanyID int64     `json:"company_id"`
    Balance   float64   `json:"balance"`
    Currency  string    `json:"currency"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type MerchantTransaction struct {
    ID          int64      `json:"id"`
    CompanyID   int64      `json:"company_id"`
    OrderID     *int64     `json:"order_id,omitempty"`
    Amount      float64    `json:"amount"`
    Type        string     `json:"type"` // order_earning, settlement, adjustment, refund
    Status      string     `json:"status"` // pending, completed, failed
    Description string     `json:"description"`
    CreatedAt   time.Time  `json:"created_at"`
    CompletedAt *time.Time `json:"completed_at,omitempty"`
}

type Settlement struct {
    ID              int64      `json:"id"`
    CompanyID       int64      `json:"company_id"`
    PeriodStart     time.Time  `json:"period_start"`
    PeriodEnd       time.Time  `json:"period_end"`
    GrossAmount     float64    `json:"gross_amount"`
    CommissionAmount float64   `json:"commission_amount"`
    NetAmount       float64    `json:"net_amount"`
    Status          string     `json:"status"` // pending, calculated, approved, paid, cancelled
    PaidAt          *time.Time `json:"paid_at,omitempty"`
    CreatedAt       time.Time  `json:"created_at"`
    UpdatedAt       time.Time  `json:"updated_at"`
}
