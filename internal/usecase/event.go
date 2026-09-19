package usecase

import (
    "context"
    "errors"
    "strings"
    "time"

    "your-project/internal/domain"
    "your-project/internal/repository"
)

type EventUsecase struct {
    offerRepo      repository.OfferRepository
    orderUsecase   *OrderUsecase
    userRepo       repository.UserRepository
    attendeeRepo   repository.EventAttendeeRepository
    friendshipRepo repository.FriendshipRepository
}

func NewEventUsecase(
    offerRepo repository.OfferRepository,
    orderUsecase *OrderUsecase,
    userRepo repository.UserRepository,
    attendeeRepo repository.EventAttendeeRepository,
    friendshipRepo repository.FriendshipRepository,
) *EventUsecase {
    return &EventUsecase{
        offerRepo:      offerRepo,
        orderUsecase:   orderUsecase,
        userRepo:       userRepo,
        attendeeRepo:   attendeeRepo,
        friendshipRepo: friendshipRepo,
    }
}

// canAccessEvents — правило доступа к ивентам:
// admin / merchant / verified student
func canAccessEvents(u *domain.User) bool {
    if u == nil {
        return false
    }
    if u.Role == "admin" || u.Role == "merchant" {
        return true
    }
    return u.StudentStatus == "verified"
}

type CreateEventInput struct {
    OrganizerID       int64
    CompanyID         *int64
    Title             string
    Description       string
    StartAt           time.Time
    EndAt             time.Time
    Address           *string
    Latitude          *float64
    Longitude         *float64
    ImageURL          *string
    EventPrivacy      string
    EventUniversityID *int64
    MaxUses           *int
    SpecialPrice      *float64
}

func (u *EventUsecase) CreateEvent(ctx context.Context, input CreateEventInput) (*domain.Offer, error) {
    user, err := u.userRepo.GetByID(ctx, input.OrganizerID)
    if err != nil || user == nil {
        return nil, errors.New("пользователь не найден")
    }
    if !canAccessEvents(user) {
        return nil, errors.New("только верифицированные пользователи могут создавать ивенты")
    }
    if strings.TrimSpace(input.Title) == "" {
        return nil, errors.New("укажите название")
    }
    if input.StartAt.IsZero() {
        return nil, errors.New("укажите дату начала")
    }
    if input.EndAt.IsZero() {
        input.EndAt = input.StartAt.Add(2 * time.Hour)
    }
    if input.EndAt.Before(input.StartAt) {
        return nil, errors.New("дата окончания раньше начала")
    }

    privacy := input.EventPrivacy
    if privacy == "" {
        privacy = domain.EventPrivacyPublic
    }
    if !domain.IsValidEventPrivacy(privacy) {
        return nil, errors.New("неверный уровень приватности")
    }

    // По умолчанию — бесплатный ивент
    discountType := "fixed"
    discountValue := 0.0
    if input.SpecialPrice != nil && *input.SpecialPrice > 0 {
        discountValue = *input.SpecialPrice
    }

    event := &domain.Offer{
        CompanyID:         input.CompanyID,
        Title:             input.Title,
        Description:       input.Description,
        DiscountType:      discountType,
        DiscountValue:     discountValue,
        SpecialPrice:      input.SpecialPrice,
        StartAt:           input.StartAt,
        EndAt:             input.EndAt,
        Status:            "draft", // обычная модерация
        MaxUses:           input.MaxUses,
        BonusAllowed:      false,
        MaxBonusPercent:   0,
        ImageURL:          input.ImageURL,
        Address:           input.Address,
        IsEvent:           true,
        OrganizerID:       &input.OrganizerID,
        EventPrivacy:      privacy,
        EventUniversityID: input.EventUniversityID,
    }

    if err := u.offerRepo.Create(ctx, event); err != nil {
        return nil, err
    }
    return event, nil
}

func (u *EventUsecase) SubmitForReview(ctx context.Context, userID, eventID int64) error {
    event, err := u.offerRepo.GetByID(ctx, eventID)
    if err != nil || event == nil {
        return errors.New("ивент не найден")
    }
    if !event.IsEvent {
        return errors.New("это не ивент")
    }
    if event.OrganizerID == nil || *event.OrganizerID != userID {
        return errors.New("это не ваш ивент")
    }
    if event.Status != "draft" {
        return errors.New("ивент нельзя отправить на модерацию в текущем статусе")
    }
    return u.offerRepo.UpdateStatus(ctx, eventID, "pending_review")
}

// ListEvents — публичный список, фильтрует по приватности относительно текущего юзера.
func (u *EventUsecase) ListEvents(ctx context.Context, currentUserID int64, limit, offset int) ([]domain.Offer, error) {
    events, err := u.offerRepo.ListEvents(ctx, nil, "published", limit, offset)
    if err != nil {
        return nil, err
    }
    if currentUserID == 0 {
        return []domain.Offer{}, nil
    }
    user, err := u.userRepo.GetByID(ctx, currentUserID)
    if err != nil || user == nil || !canAccessEvents(user) {
        return []domain.Offer{}, nil
    }

    result := make([]domain.Offer, 0, len(events))
    for _, e := range events {
        ok, _ := u.canViewEvent(ctx, currentUserID, &e)
        if ok {
            result = append(result, e)
        }
    }
    return result, nil
}

// GetEvent — детали ивента с проверкой приватности + статус текущего юзера.
func (u *EventUsecase) GetEvent(ctx context.Context, eventID, currentUserID int64) (*domain.Offer, error) {
    event, err := u.offerRepo.GetByID(ctx, eventID)
    if err != nil || event == nil || !event.IsEvent {
        return nil, errors.New("ивент не найден")
    }
    if currentUserID == 0 {
        return nil, errors.New("требуется авторизация")
    }
    user, err := u.userRepo.GetByID(ctx, currentUserID)
    if err != nil || user == nil || !canAccessEvents(user) {
        return nil, errors.New("доступ только для верифицированных студентов")
    }
    ok, err := u.canViewEvent(ctx, currentUserID, event)
    if err != nil {
        return nil, err
    }
    if !ok {
        return nil, errors.New("нет доступа к этому ивенту")
    }

    // Счётчик участников
    count, _ := u.attendeeRepo.CountByEvent(ctx, eventID, domain.AttendeeGoing)
    event.AttendeesCount = count

    // Мой статус
    if a, err := u.attendeeRepo.GetByEventAndUser(ctx, eventID, currentUserID); err == nil && a != nil {
        event.MyAttendeeStatus = &a.Status
    }

    return event, nil
}

// canViewEvent — проверка приватности ивента для юзера.
func (u *EventUsecase) canViewEvent(ctx context.Context, userID int64, e *domain.Offer) (bool, error) {
    if e.OrganizerID != nil && *e.OrganizerID == userID {
        return true, nil // организатор всегда видит свой ивент
    }
    switch e.EventPrivacy {
    case domain.EventPrivacyPublic:
        return true, nil
    case domain.EventPrivacyFriends:
        if e.OrganizerID == nil {
            return false, nil
        }
        f, err := u.friendshipRepo.GetBetween(ctx, userID, *e.OrganizerID)
        if err != nil || f == nil {
            return false, nil
        }
        return f.Status == "accepted", nil
    case domain.EventPrivacySubscribers:
        // Подписчики компании-организатора — проверка на фронте не нужна, тут упрощённо
        // TODO: проверка company_subscriptions
        return true, nil
    case domain.EventPrivacyUniversity:
        if e.EventUniversityID == nil {
            return false, nil
        }
        user, err := u.userRepo.GetByID(ctx, userID)
        if err != nil || user == nil || user.UniversityID == nil {
            return false, nil
        }
        return *user.UniversityID == *e.EventUniversityID, nil
    case domain.EventPrivacyInviteOnly:
        return false, nil // TODO: приглашения
    }
    return false, nil
}

// ScheduleEvent — создаёт order со статусом created.
func (u *EventUsecase) ScheduleEvent(ctx context.Context, userID, eventID int64) (*domain.Order, error) {
    event, err := u.GetEvent(ctx, eventID, userID)
    if err != nil {
        return nil, err
    }
    if event.Status != "published" {
        return nil, errors.New("ивент ещё не опубликован")
    }
    return u.orderUsecase.CreateOrder(ctx, CreateOrderInput{
        UserID:      userID,
        OfferID:     eventID,
        BonusPoints: 0,
    })
}

// CancelSchedule — отмена RSVP или запланированной оплаты.
func (u *EventUsecase) CancelSchedule(ctx context.Context, userID, eventID int64) error {
    return u.attendeeRepo.Delete(ctx, eventID, userID)
}

// MyEvents — ивенты, которые я организую.
func (u *EventUsecase) MyEvents(ctx context.Context, userID int64) ([]domain.Offer, error) {
    return u.offerRepo.ListEvents(ctx, &userID, "", 100, 0)
}

// EventsByUsername — ивенты организатора для публичного профиля.
func (u *EventUsecase) EventsByUsername(ctx context.Context, username string, currentUserID int64) ([]domain.Offer, error) {
    organizer, err := u.userRepo.GetByUsername(ctx, username)
    if err != nil || organizer == nil {
        return []domain.Offer{}, nil
    }
    events, err := u.offerRepo.ListEvents(ctx, &organizer.ID, "published", 100, 0)
    if err != nil {
        return nil, err
    }
    result := make([]domain.Offer, 0, len(events))
    for _, e := range events {
        ok, _ := u.canViewEvent(ctx, currentUserID, &e)
        if ok {
            result = append(result, e)
        }
    }
    return result, nil
}

// RegisterAttendee — вызывается из OrderUsecase при оплате.
func (u *EventUsecase) RegisterAttendee(ctx context.Context, userID, eventID, orderID int64) error {
    return u.attendeeRepo.Upsert(ctx, &domain.EventAttendee{
        EventID: eventID,
        UserID:  userID,
        Status:  domain.AttendeeGoing,
        OrderID: &orderID,
    })
}


// MyEventsByStatus — ивенты организатора с фильтром по статусу (для /merchant/events)
func (u *EventUsecase) MyEventsByStatus(ctx context.Context, userID int64, status string, limit, offset int) ([]domain.Offer, error) {
    return u.offerRepo.ListEvents(ctx, &userID, status, limit, offset)
}

// AttendingByUsername — ивенты, куда идёт юзер (для блока на /@username)
func (u *EventUsecase) AttendingByUsername(ctx context.Context, username string, currentUserID int64) ([]domain.Offer, error) {
    user, err := u.userRepo.GetByUsername(ctx, username)
    if err != nil || user == nil {
        return []domain.Offer{}, nil
    }
    ids, err := u.attendeeRepo.ListEventIDsByUser(ctx, user.ID, domain.AttendeeGoing)
    if err != nil || len(ids) == 0 {
        return []domain.Offer{}, nil
    }
    result := make([]domain.Offer, 0, len(ids))
    for _, id := range ids {
        e, err := u.offerRepo.GetByID(ctx, id)
        if err != nil || e == nil || !e.IsEvent || e.Status != "published" {
            continue
        }
        ok, _ := u.canViewEvent(ctx, currentUserID, e)
        if ok {
            result = append(result, *e)
        }
    }
    return result, nil
}
