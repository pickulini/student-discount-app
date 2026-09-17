package domain

import "time"

type Offer struct {
    ID              int64      `json:"id"`
    CompanyID       int64      `json:"company_id"`
    Title           string     `json:"title"`
    Description     string     `json:"description"`
    Terms           *string    `json:"terms,omitempty"`
    DiscountType    string     `json:"discount_type"`
    DiscountValue   float64    `json:"discount_value"`
    SpecialPrice    *float64   `json:"special_price,omitempty"`
    StartAt         time.Time  `json:"start_at"`
    EndAt           time.Time  `json:"end_at"`
    Status          string     `json:"status"`
    MaxUses         *int       `json:"max_uses,omitempty"`
    CurrentUses     int        `json:"current_uses"`
    BonusAllowed    bool       `json:"bonus_allowed"`
    MaxBonusPercent int        `json:"max_bonus_percent"`
    Tags            []Tag      `json:"tags,omitempty"`
    ImageURL        *string    `json:"image_url,omitempty"`
    Address         *string    `json:"address,omitempty"`
    Phone           *string    `json:"phone,omitempty"`
    Website         *string    `json:"website,omitempty"`
    WorkingHours    *string    `json:"working_hours,omitempty"`
    RejectionReason *string    `json:"rejection_reason,omitempty"`
    CreatedAt       time.Time  `json:"created_at"`
    UpdatedAt       time.Time  `json:"updated_at"`
}
