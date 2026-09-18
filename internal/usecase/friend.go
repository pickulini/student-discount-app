package usecase

import (
    "context"
    "errors"
    "strings"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type FriendUsecase struct {
    friendRepo repository.FriendshipRepository
    userRepo   repository.UserRepository
}

func NewFriendUsecase(
    friendRepo repository.FriendshipRepository,
    userRepo repository.UserRepository,
) *FriendUsecase {
    return &FriendUsecase{
        friendRepo: friendRepo,
        userRepo:   userRepo,
    }
}

// SearchUsers — поиск по @username или никнейму
func (u *FriendUsecase) SearchUsers(ctx context.Context, currentUserID int64, query string) ([]domain.UserPublicCard, error) {
    query = strings.TrimSpace(query)
    if len(query) < 2 {
        return []domain.UserPublicCard{}, nil
    }
    // Убираем @, если есть
    query = strings.TrimPrefix(query, "@")

    users, err := u.userRepo.SearchUsers(ctx, currentUserID, query, 20)
    if err != nil {
        return nil, err
    }
    return users, nil
}

// SendFriendRequest
func (u *FriendUsecase) SendFriendRequest(ctx context.Context, requesterID, addresseeID int64) (*domain.Friendship, error) {
    if requesterID == addresseeID {
        return nil, errors.New("нельзя добавить себя в друзья")
    }
    // Проверим, что адресат существует
    target, err := u.userRepo.GetByID(ctx, addresseeID)
    if err != nil || target == nil {
        return nil, errors.New("пользователь не найден")
    }

    // Проверим существующую связь
    existing, _ := u.friendRepo.GetBetween(ctx, requesterID, addresseeID)
    if existing != nil {
        switch existing.Status {
        case "pending":
            return nil, errors.New("заявка уже отправлена или ожидает ответа")
        case "accepted":
            return nil, errors.New("вы уже друзья")
        case "rejected", "cancelled":
            // Можно переиспользовать эту запись — обновим до pending и поменяем направление
            // Проще удалить и создать заново
            _ = u.friendRepo.Delete(ctx, existing.ID)
        }
    }

    return u.friendRepo.Create(ctx, requesterID, addresseeID)
}

// AcceptFriendRequest
func (u *FriendUsecase) AcceptFriendRequest(ctx context.Context, userID, friendshipID int64) error {
	f, err := u.friendRepo.GetByID(ctx, friendshipID)
	if err != nil || f == nil {
		return errors.New("заявка не найдена")
	}
	if f.AddresseeID != userID {
		return errors.New("это не ваша заявка")
	}
	if f.Status != "pending" {
		return errors.New("заявка уже обработана")
	}
	return u.friendRepo.UpdateStatus(ctx, friendshipID, "accepted")
}

// RejectFriendRequest
func (u *FriendUsecase) RejectFriendRequest(ctx context.Context, userID, friendshipID int64) error {
	f, err := u.friendRepo.GetByID(ctx, friendshipID)
	if err != nil || f == nil {
		return errors.New("заявка не найдена")
	}
	if f.AddresseeID != userID {
		return errors.New("это не ваша заявка")
	}
	if f.Status != "pending" {
		return errors.New("заявка уже обработана")
	}
	return u.friendRepo.UpdateStatus(ctx, friendshipID, "rejected")
}

// CancelFriendRequest (отменить свою исходящую)
func (u *FriendUsecase) CancelFriendRequest(ctx context.Context, userID, friendshipID int64) error {
	f, err := u.friendRepo.GetByID(ctx, friendshipID)
	if err != nil || f == nil {
		return errors.New("заявка не найдена")
	}
	if f.RequesterID != userID {
		return errors.New("это не ваша заявка")
	}
	if f.Status != "pending" {
		return errors.New("заявка уже обработана")
	}
	return u.friendRepo.UpdateStatus(ctx, friendshipID, "cancelled")
}

// RemoveFriend (удалить из друзей)
func (u *FriendUsecase) RemoveFriend(ctx context.Context, userID, friendID int64) error {
    f, err := u.friendRepo.GetBetween(ctx, userID, friendID)
    if err != nil || f == nil {
        return errors.New("связь не найдена")
    }
    if f.Status != "accepted" {
        return errors.New("вы не друзья")
    }
    return u.friendRepo.Delete(ctx, f.ID)
}

// ListFriends
func (u *FriendUsecase) ListFriends(ctx context.Context, userID int64) ([]domain.UserPublicCard, error) {
    return u.friendRepo.ListFriends(ctx, userID)
}

func (u *FriendUsecase) ListIncomingRequests(ctx context.Context, userID int64) ([]domain.UserPublicCard, error) {
    return u.friendRepo.ListIncomingRequests(ctx, userID)
}

func (u *FriendUsecase) ListOutgoingRequests(ctx context.Context, userID int64) ([]domain.UserPublicCard, error) {
    return u.friendRepo.ListOutgoingRequests(ctx, userID)
}

func (u *FriendUsecase) CountIncomingRequests(ctx context.Context, userID int64) (int, error) {
    return u.friendRepo.CountIncomingRequests(ctx, userID)
}

// GetFriendStatus — для карточки пользователя
func (u *FriendUsecase) GetFriendStatus(ctx context.Context, currentUserID, otherUserID int64) (*domain.FriendStatusResponse, error) {
    if currentUserID == otherUserID {
        return &domain.FriendStatusResponse{UserID: otherUserID, Status: "self"}, nil
    }
    f, _ := u.friendRepo.GetBetween(ctx, currentUserID, otherUserID)
    if f == nil {
        return &domain.FriendStatusResponse{UserID: otherUserID, Status: "none"}, nil
    }
    resp := &domain.FriendStatusResponse{UserID: otherUserID, FriendshipID: &f.ID}
    switch f.Status {
    case "accepted":
        resp.Status = "friends"
    case "pending":
        if f.RequesterID == currentUserID {
            resp.Status = "pending_outgoing"
        } else {
            resp.Status = "pending_incoming"
        }
    case "rejected", "cancelled":
        resp.Status = "none"
    }
    return resp, nil
}
