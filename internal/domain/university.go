package domain

import "time"

type University struct {
    ID        int64     `json:"id"`
    Name      string    `json:"name"`
    ShortName string    `json:"short_name"`
    Domains   []string  `json:"domains"`
    IsActive  bool      `json:"is_active"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
