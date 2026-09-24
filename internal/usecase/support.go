package usecase

import (
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type SupportUsecase struct {
    ticketRepo repository.SupportTicketRepository
    msgRepo    repository.SupportMessageRepository
    userRepo   repository.UserRepository
    notifUC    *NotificationUsecase
}

func NewSupportUsecase(
    ticketRepo repository.SupportTicketRepository,
    msgRepo repository.SupportMessageRepository,
    userRepo repository.UserRepository,
    notifUC *NotificationUsecase,
) *SupportUsecase {
    return &SupportUsecase{
        ticketRepo: ticketRepo,
        msgRepo:    msgRepo,
        userRepo:   userRepo,
        notifUC:    notifUC,
    }
}

// Пользователь создаёт тикет
func (u *SupportUsecase) CreateTicket(ctx context.Context, userID int64, subject, firstMessage string) (*domain.SupportTicket, error) {
    ticket := &domain.SupportTicket{
        UserID:   userID,
        Subject:  subject,
        Status:   "open",
        Priority: "normal",
    }
    if err := u.ticketRepo.Create(ctx, ticket); err != nil {
        return nil, err
    }
    // Добавляем первое сообщение
    msg := &domain.SupportMessage{
        TicketID:   ticket.ID,
        UserID:     userID,
        Message:    firstMessage,
        IsInternal: false,
    }
    if err := u.msgRepo.Create(ctx, msg); err != nil {
        return nil, err
    }

    // Уведомление админам
    if u.notifUC != nil {
        _ = u.notifUC.NotifyAdmins(ctx, CreateNotificationInput{
            Type:          "new_support_ticket",
            Title:         "Новое обращение: " + subject,
            Link:          "/admin/support",
            ReferenceType: "support_ticket",
            ReferenceID:   &ticket.ID,
        })
        u.notifUC.BroadcastAdminEvent("new_support_ticket", map[string]interface{}{
            "ticket_id": ticket.ID,
            "subject":   subject,
        })
    }
    return ticket, nil
}

// Пользователь добавляет сообщение в тикет
func (u *SupportUsecase) AddMessage(ctx context.Context, ticketID, userID int64, message string, isInternal bool) (*domain.SupportMessage, error) {
    // Проверяем, что тикет принадлежит пользователю (если не админ)
    // Для простоты проверку сделаем в хендлере
    msg := &domain.SupportMessage{
        TicketID:   ticketID,
        UserID:     userID,
        Message:    message,
        IsInternal: isInternal,
    }
    if err := u.msgRepo.Create(ctx, msg); err != nil {
        return nil, err
    }

    if u.notifUC != nil {
        // Загружаем тикет, чтобы понять кому слать
        ticket, err := u.ticketRepo.GetByID(ctx, ticketID)
        if err == nil && ticket != nil {
            // Если сообщение от админа (isInternal=true) — уведомляем владельца
            // Если от юзера — уведомляем всех админов
            if isInternal {
                _ = u.notifUC.Create(ctx, CreateNotificationInput{
                    UserID:        ticket.UserID,
                    Type:          "support_reply",
                    Title:         "Ответ поддержки по обращению: " + ticket.Subject,
                    Link:          "/support",
                    ActorID:       &userID,
                    ReferenceType: "support_ticket",
                    ReferenceID:   &ticketID,
                })
            } else {
                _ = u.notifUC.NotifyAdmins(ctx, CreateNotificationInput{
                    Type:          "support_message",
                    Title:         "Новое сообщение в обращении: " + ticket.Subject,
                    Link:          "/admin/support",
                    ActorID:       &userID,
                    ReferenceType: "support_ticket",
                    ReferenceID:   &ticketID,
                })
            }
            // Broadcast в SSE для real-time обновления чата
            u.notifUC.BroadcastSupportMessage(map[string]interface{}{
                "ticket_id":   ticketID,
                "user_id":     userID,
                "message":     message,
                "is_internal": isInternal,
                "created_at":  msg.CreatedAt,
            })
        }
    }

    return msg, nil
}

// Пользователь получает список своих тикетов
func (u *SupportUsecase) GetUserTickets(ctx context.Context, userID int64) ([]domain.SupportTicket, error) {
    return u.ticketRepo.ListByUserID(ctx, userID)
}

// Пользователь получает сообщения тикета
func (u *SupportUsecase) GetTicketMessages(ctx context.Context, ticketID, userID int64) ([]domain.SupportMessage, error) {
    // Здесь можно проверить, что тикет принадлежит пользователю, но сделаем в хендлере
    return u.msgRepo.GetByTicketID(ctx, ticketID)
}

// Админ: список всех тикетов
func (u *SupportUsecase) ListAllTickets(ctx context.Context, limit, offset int) ([]domain.SupportTicket, error) {
    return u.ticketRepo.ListAll(ctx, limit, offset)
}

// Админ: обновить статус тикета
func (u *SupportUsecase) UpdateTicketStatus(ctx context.Context, ticketID int64, status string) error {
    return u.ticketRepo.UpdateStatus(ctx, ticketID, status)
}

// Админ: назначить ответственного
func (u *SupportUsecase) AssignTicket(ctx context.Context, ticketID, adminID int64) error {
    return u.ticketRepo.UpdateAssignedTo(ctx, ticketID, adminID)
}

// OwnsTicket — принадлежит ли обращение пользователю.
func (u *SupportUsecase) OwnsTicket(ctx context.Context, ticketID, userID int64) bool {
    t, err := u.ticketRepo.GetByID(ctx, ticketID)
    return err == nil && t != nil && t.UserID == userID
}

// GetTicket — обращение по ID (для админки).
func (u *SupportUsecase) GetTicket(ctx context.Context, ticketID int64) (*domain.SupportTicket, error) {
    return u.ticketRepo.GetByID(ctx, ticketID)
}
