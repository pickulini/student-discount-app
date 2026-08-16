package domain

import "time"

type CompanyUser struct {
    ID        int64     `json:"id"`
    UserID    int64     `json:"user_id"`
    CompanyID int64     `json:"company_id"`
    Role      string    `json:"role"` // admin, manager
    CreatedAt time.Time `json:"created_at"`
}
