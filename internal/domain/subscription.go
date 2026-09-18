package domain

import "time"

type CompanySubscription struct {
    UserID    int64     `json:"user_id"`
    CompanyID int64     `json:"company_id"`
    CreatedAt time.Time `json:"created_at"`
}

// Информация о компании с признаком подписки для UI
type CompanyWithSubscription struct {
    ID           int64   `json:"id"`
    Name         string  `json:"name"`
    Description  string  `json:"description"`
    LogoKey      *string `json:"logo_key,omitempty"`
    IsSubscribed bool    `json:"is_subscribed"`
    IsActive     bool    `json:"is_active"`
}

// Счётчики компании
type CompanyStats struct {
    SubscribersCount int `json:"subscribers_count"`
    OffersCount      int `json:"offers_count"`
}
