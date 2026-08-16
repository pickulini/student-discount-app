package usecase

import (
    "context"
    "errors"
    "log"
    "your-project/internal/domain"
    "your-project/internal/repository"
)

type PaymentUsecase struct {
    accountRepo repository.AccountRepository
    ledgerRepo  repository.LedgerRepository
    bonusRepo   repository.BonusRepository
}

func NewPaymentUsecase(
    accountRepo repository.AccountRepository,
    ledgerRepo repository.LedgerRepository,
    bonusRepo repository.BonusRepository,
) *PaymentUsecase {
    return &PaymentUsecase{
        accountRepo: accountRepo,
        ledgerRepo:  ledgerRepo,
        bonusRepo:   bonusRepo,
    }
}

type DepositInput struct {
    UserID int64
    Amount float64
}

func (u *PaymentUsecase) Deposit(ctx context.Context, input DepositInput) (float64, error) {
    if input.Amount <= 0 {
        return 0, errors.New("amount must be positive")
    }

    account, err := u.accountRepo.GetByUserIDAndType(ctx, input.UserID, "cash")
    if err != nil {
        log.Printf("failed to get account for user %d: %v", input.UserID, err)
        return 0, err
    }
    log.Printf("current balance for account %d: %f", account.ID, account.Balance)

    // Используем функцию generateIdempotencyKey из order.go (она объявлена в том же пакете)
    idempotencyKey := generateIdempotencyKey(input.UserID, 0)

    ledgerTx := &domain.LedgerTransaction{
        Type:           "deposit",
        Status:         "pending",
        IdempotencyKey: idempotencyKey,
        ReferenceType:  "payment",
        ReferenceID:    0,
        Description:    "Пополнение баланса",
    }
    if err := u.ledgerRepo.CreateTransaction(ctx, ledgerTx); err != nil {
        log.Printf("failed to create ledger transaction: %v", err)
        return 0, err
    }

    entry := &domain.LedgerEntry{
        TransactionID: ledgerTx.ID,
        AccountID:     account.ID,
        Amount:        input.Amount,
    }
    if err := u.ledgerRepo.CreateEntry(ctx, entry); err != nil {
        log.Printf("failed to create ledger entry: %v", err)
        return 0, err
    }

    newBalance := account.Balance + input.Amount
    if err := u.accountRepo.UpdateBalance(ctx, account.ID, newBalance); err != nil {
        log.Printf("failed to update account balance: %v", err)
        return 0, err
    }
    log.Printf("new balance for account %d: %f", account.ID, newBalance)

    if err := u.ledgerRepo.UpdateTransactionStatus(ctx, ledgerTx.ID, "completed"); err != nil {
        log.Printf("failed to update ledger transaction status: %v", err)
    }

    return newBalance, nil
}
