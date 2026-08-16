package domain

import "time"

type SupportTicket struct {
    ID         int64      `json:"id"`
    UserID     int64      `json:"user_id"`
    Subject    string     `json:"subject"`
    Status     string     `json:"status"` // open, in_progress, resolved, closed
    Priority   string     `json:"priority"`
    AssignedTo *int64     `json:"assigned_to,omitempty"`
    CreatedAt  time.Time  `json:"created_at"`
    UpdatedAt  time.Time  `json:"updated_at"`
    ClosedAt   *time.Time `json:"closed_at,omitempty"`
}

type SupportMessage struct {
    ID         int64     `json:"id"`
    TicketID   int64     `json:"ticket_id"`
    UserID     int64     `json:"user_id"`
    Message    string    `json:"message"`
    IsInternal bool      `json:"is_internal"` // для сообщений админа (не видны пользователю)
    CreatedAt  time.Time `json:"created_at"`
}
