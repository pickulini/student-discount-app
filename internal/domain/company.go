package domain

import "time"

type Company struct {
    ID          int64      `json:"id"`
    Name        string     `json:"name"`
    Description string     `json:"description"`
    LogoKey     *string    `json:"logo_key,omitempty"`
    Website     *string    `json:"website,omitempty"`
    Phone       *string    `json:"phone,omitempty"`
    CategoryID  *int64     `json:"category_id,omitempty"`
    IsActive    bool       `json:"is_active"`
    CreatedAt   time.Time  `json:"created_at"`
    UpdatedAt   time.Time  `json:"updated_at"`
}

type CompanyLocation struct {
    ID           int64      `json:"id"`
    CompanyID    int64      `json:"company_id"`
    Name         string     `json:"name"`
    Address      string     `json:"address"`
    Latitude     *float64   `json:"latitude,omitempty"`
    Longitude    *float64   `json:"longitude,omitempty"`
    Phone        *string    `json:"phone,omitempty"`
    OpeningHours *string    `json:"opening_hours,omitempty"`
    IsActive     bool       `json:"is_active"`
    CreatedAt    time.Time  `json:"created_at"`
    UpdatedAt    time.Time  `json:"updated_at"`
}
