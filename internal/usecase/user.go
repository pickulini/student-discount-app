package usecase

import (
    "context"
    "errors"
    "strings"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type UserUsecase struct {
    userRepo         repository.UserRepository
    accountRepo      repository.AccountRepository
    bonusRepo        repository.BonusRepository
    ledgerRepo       repository.LedgerRepository
    verificationRepo repository.StudentVerificationRepository
    companyRepo      repository.CompanyRepository
}

func NewUserUsecase(
    userRepo repository.UserRepository,
    accountRepo repository.AccountRepository,
    bonusRepo repository.BonusRepository,
    ledgerRepo repository.LedgerRepository,
    verificationRepo repository.StudentVerificationRepository,
    companyRepo repository.CompanyRepository,
) *UserUsecase {
    return &UserUsecase{
        userRepo:         userRepo,
        accountRepo:      accountRepo,
        bonusRepo:        bonusRepo,
        ledgerRepo:       ledgerRepo,
        verificationRepo: verificationRepo,
        companyRepo:      companyRepo,
    }
}

func (u *UserUsecase) GetProfile(ctx context.Context, userID int64) (*domain.User, float64, float64, error) {
    user, err := u.userRepo.GetByID(ctx, userID)
    if err != nil {
        return nil, 0, 0, err
    }
    account, err := u.accountRepo.GetByUserIDAndType(ctx, userID, "cash")
    if err != nil {
        return nil, 0, 0, err
    }
    bonusAcc, err := u.bonusRepo.GetByUserID(ctx, userID)
    if err != nil {
        return nil, 0, 0, err
    }
    user.Balance = account.Balance

    verif, err := u.verificationRepo.GetByUserID(ctx, userID)
    if err == nil && verif != nil {
        user.VerificationExpiresAt = verif.ExpiresAt
    }

    return user, account.Balance, bonusAcc.Balance, nil
}

func (u *UserUsecase) GetTransactionHistory(ctx context.Context, userID int64, limit, offset int) ([]domain.TransactionHistory, error) {
    return u.ledgerRepo.GetTransactionsByUserID(ctx, userID, limit, offset)
}

// UpdateProfile делает частичное обновление — меняет только переданные поля
func (u *UserUsecase) UpdateProfile(ctx context.Context, userID int64, nickname, username, avatarURL *string, privacyAllowSubscriptions *bool) error {
    // Загружаем текущего пользователя
    user, err := u.userRepo.GetByID(ctx, userID)
    if err != nil {
        return err
    }

    // Обрабатываем nickname — если передан пустой, сбрасываем
    var newNickname *string
    if nickname != nil {
        trimmed := strings.TrimSpace(*nickname)
        if trimmed != "" {
            newNickname = &trimmed
        }
    } else {
        newNickname = user.Nickname
    }

    // Обрабатываем avatar_url — если передан пустой, сбрасываем
    var newAvatarURL *string
    if avatarURL != nil {
        trimmed := strings.TrimSpace(*avatarURL)
        if trimmed != "" {
            newAvatarURL = &trimmed
        }
    } else {
        newAvatarURL = user.AvatarURL
    }

    // Обрабатываем username — если передан, валидируем и проверяем уникальность
    var newUsername *string
    if username != nil {
        trimmed := strings.ToLower(strings.TrimSpace(*username))
        if trimmed == "" {
            // Пустая строка = сброс username
            newUsername = nil
        } else {
            // Валидация
            if len(trimmed) < 3 || len(trimmed) > 30 {
                return errors.New("username должен быть от 3 до 30 символов")
            }
            for _, r := range trimmed {
                if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_') {
                    return errors.New("username может содержать только латиницу, цифры и _")
                }
            }
            // Проверка уникальности
            existing, _ := u.userRepo.GetByUsername(ctx, trimmed)
            if existing != nil && existing.ID != userID {
                return errors.New("username уже занят")
            }
            newUsername = &trimmed
        }
    } else {
        newUsername = user.Username
    }

    return u.userRepo.UpdateProfile(ctx, userID, newNickname, newUsername, newAvatarURL, privacyAllowSubscriptions)
}

// GetPublicProfile возвращает публичные данные пользователя по username
func (u *UserUsecase) GetPublicProfile(ctx context.Context, username string) (*domain.UserPublicProfile, error) {
    return u.userRepo.GetPublicProfileByUsername(ctx, username)
}


// GetCompaniesByUsername возвращает компании, привязанные к юзеру по username.
// currentUserID = 0 — гость, is_subscribed везде false.
func (u *UserUsecase) GetCompaniesByUsername(ctx context.Context, username string, currentUserID int64) ([]domain.CompanyWithSubscription, error) {
    return u.companyRepo.ListByUserUsername(ctx, username, currentUserID)
}
