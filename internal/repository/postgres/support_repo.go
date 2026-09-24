package postgres

import (
    "context"
    "database/sql"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type SupportTicketRepo struct {
    db *DB
}

func NewSupportTicketRepo(db *DB) repository.SupportTicketRepository {
    return &SupportTicketRepo{db: db}
}

func (r *SupportTicketRepo) Create(ctx context.Context, ticket *domain.SupportTicket) error {
    query := `INSERT INTO support_tickets (user_id, subject, status, priority, assigned_to) 
              VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, updated_at`
    err := r.db.Pool.QueryRow(ctx, query,
        ticket.UserID, ticket.Subject, ticket.Status, ticket.Priority, ticket.AssignedTo,
    ).Scan(&ticket.ID, &ticket.CreatedAt, &ticket.UpdatedAt)
    return err
}

func (r *SupportTicketRepo) GetByID(ctx context.Context, id int64) (*domain.SupportTicket, error) {
    query := `SELECT id, user_id, subject, status, priority, assigned_to, created_at, updated_at, closed_at 
              FROM support_tickets WHERE id = $1`
    var t domain.SupportTicket
    var assignedTo sql.NullInt64
    var closedAt sql.NullTime
    err := r.db.Pool.QueryRow(ctx, query, id).Scan(
        &t.ID, &t.UserID, &t.Subject, &t.Status, &t.Priority,
        &assignedTo, &t.CreatedAt, &t.UpdatedAt, &closedAt,
    )
    if err != nil {
        return nil, err
    }
    if assignedTo.Valid {
        t.AssignedTo = &assignedTo.Int64
    }
    if closedAt.Valid {
        t.ClosedAt = &closedAt.Time
    }
    return &t, nil
}

func (r *SupportTicketRepo) ListByUserID(ctx context.Context, userID int64) ([]domain.SupportTicket, error) {
    query := `SELECT id, user_id, subject, status, priority, assigned_to, created_at, updated_at, closed_at 
              FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC`
    rows, err := r.db.Pool.Query(ctx, query, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var tickets []domain.SupportTicket
    for rows.Next() {
        var t domain.SupportTicket
        var assignedTo sql.NullInt64
        var closedAt sql.NullTime
        if err := rows.Scan(&t.ID, &t.UserID, &t.Subject, &t.Status, &t.Priority,
            &assignedTo, &t.CreatedAt, &t.UpdatedAt, &closedAt); err != nil {
            return nil, err
        }
        if assignedTo.Valid {
            t.AssignedTo = &assignedTo.Int64
        }
        if closedAt.Valid {
            t.ClosedAt = &closedAt.Time
        }
        tickets = append(tickets, t)
    }
    return tickets, nil
}

func (r *SupportTicketRepo) ListAll(ctx context.Context, limit, offset int) ([]domain.SupportTicket, error) {
    query := `SELECT id, user_id, subject, status, priority, assigned_to, created_at, updated_at, closed_at 
              FROM support_tickets ORDER BY created_at DESC LIMIT $1 OFFSET $2`
    rows, err := r.db.Pool.Query(ctx, query, limit, offset)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var tickets []domain.SupportTicket
    for rows.Next() {
        var t domain.SupportTicket
        var assignedTo sql.NullInt64
        var closedAt sql.NullTime
        if err := rows.Scan(&t.ID, &t.UserID, &t.Subject, &t.Status, &t.Priority,
            &assignedTo, &t.CreatedAt, &t.UpdatedAt, &t.ClosedAt); err != nil {
            return nil, err
        }
        if assignedTo.Valid {
            t.AssignedTo = &assignedTo.Int64
        }
        if closedAt.Valid {
            t.ClosedAt = &closedAt.Time
        }
        tickets = append(tickets, t)
    }
    return tickets, nil
}

func (r *SupportTicketRepo) UpdateStatus(ctx context.Context, id int64, status string) error {
    query := `UPDATE support_tickets SET status=$1, updated_at=NOW() WHERE id=$2`
    _, err := r.db.Pool.Exec(ctx, query, status, id)
    return err
}

func (r *SupportTicketRepo) UpdateAssignedTo(ctx context.Context, id int64, assignedTo int64) error {
    query := `UPDATE support_tickets SET assigned_to=$1, updated_at=NOW() WHERE id=$2`
    _, err := r.db.Pool.Exec(ctx, query, assignedTo, id)
    return err
}

// --- SupportMessageRepo ---

type SupportMessageRepo struct {
    db *DB
}

func NewSupportMessageRepo(db *DB) repository.SupportMessageRepository {
    return &SupportMessageRepo{db: db}
}

func (r *SupportMessageRepo) Create(ctx context.Context, msg *domain.SupportMessage) error {
    query := `INSERT INTO support_messages (ticket_id, user_id, message, is_internal) 
              VALUES ($1, $2, $3, $4) RETURNING id, created_at`
    err := r.db.Pool.QueryRow(ctx, query,
        msg.TicketID, msg.UserID, msg.Message, msg.IsInternal,
    ).Scan(&msg.ID, &msg.CreatedAt)
    return err
}

func (r *SupportMessageRepo) GetByTicketID(ctx context.Context, ticketID int64) ([]domain.SupportMessage, error) {
    query := `SELECT id, ticket_id, user_id, message, is_internal, created_at 
              FROM support_messages WHERE ticket_id = $1 AND NOT is_note ORDER BY created_at ASC`
    rows, err := r.db.Pool.Query(ctx, query, ticketID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var messages []domain.SupportMessage
    for rows.Next() {
        var m domain.SupportMessage
        if err := rows.Scan(&m.ID, &m.TicketID, &m.UserID, &m.Message, &m.IsInternal, &m.CreatedAt); err != nil {
            return nil, err
        }
        messages = append(messages, m)
    }
    return messages, nil
}
