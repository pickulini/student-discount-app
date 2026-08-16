package usecase

import (
    "context"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type UserUsecase struct {
    userRepo    repository.UserRepository
    accountRepo repository.AccountRepository
    bonusRepo   repository.BonusRepository
    ledgerRepo  repository.LedgerRepository
}

func NewUserUsecase(
    userRepo repository.UserRepository,
    accountRepo repository.AccountRepository,
    bonusRepo repository.BonusRepository,
    ledgerRepo repository.LedgerRepository,
) *UserUsecase {
    return &UserUsecase{
        userRepo:    userRepo,
        accountRepo: accountRepo,
        bonusRepo:   bonusRepo,
        ledgerRepo:  ledgerRepo,
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
    return user, account.Balance, bonusAcc.Balance, nil
}

func (u *UserUsecase) GetTransactionHistory(ctx context.Context, userID int64, limit, offset int) ([]domain.TransactionHistory, error) {
    return u.ledgerRepo.GetTransactionsByUserID(ctx, userID, limit, offset)
}
