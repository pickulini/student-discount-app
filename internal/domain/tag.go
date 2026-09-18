package domain

import "time"

type Tag struct {
    ID        int64     `json:"id"`
    Name      string    `json:"name"`
    Slug      string    `json:"slug"`
    Status    string    `json:"status"` // pending, active, rejected
    CreatedBy *int64    `json:"created_by,omitempty"`
    CreatedAt time.Time `json:"created_at"`
}

// Публичный тег с популярностью (для главной страницы)
type TagPopular struct {
    ID         int64  `json:"id"`
    Name       string `json:"name"`
    Slug       string `json:"slug"`
    OfferCount int    `json:"offer_count"`
}
