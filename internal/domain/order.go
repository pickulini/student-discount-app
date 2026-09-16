package domain

import "time"

type Order struct {
    ID             int64     `json:"id"`
    UserID         int64     `json:"user_id"`
    CompanyID      int64     `json:"company_id"`
    LocationID     *int64    `json:"location_id,omitempty"`
    OfferID        int64     `json:"offer_id"`
    Subtotal       float64   `json:"subtotal"`
    DiscountAmount float64   `json:"discount_amount"`
    BonusAmount    float64   `json:"bonus_amount"`
    TotalAmount    float64   `json:"total_amount"`
    Commission     float64   `json:"commission"`
    Status         string    `json:"status"` // created, paid, completed, cancelled, refunded
    CreatedAt      time.Time `json:"created_at"`
    CompletedAt    *time.Time `json:"completed_at,omitempty"`
    CancelledAt    *time.Time `json:"cancelled_at,omitempty"`
}

// Статусы заказов
const (
    OrderStatusCreated   = "created"
    OrderStatusPaid      = "paid"
    OrderStatusCompleted = "completed"
    OrderStatusCancelled = "cancelled"
    OrderStatusRefunded  = "refunded"
    OrderStatusFailed    = "failed"
)

// Допустимые переходы между статусами
var ValidOrderTransitions = map[string][]string{
    OrderStatusCreated:   {OrderStatusPaid, OrderStatusCancelled, OrderStatusFailed},
    OrderStatusPaid:      {OrderStatusCompleted, OrderStatusRefunded},
    OrderStatusCompleted: {OrderStatusRefunded},
    OrderStatusCancelled: {},
    OrderStatusRefunded:  {},
    OrderStatusFailed:    {},
}

func IsValidOrderTransition(from, to string) bool {
    allowed, ok := ValidOrderTransitions[from]
    if !ok {
        return false
    }
    for _, s := range allowed {
        if s == to {
            return true
        }
    }
    return false
}
