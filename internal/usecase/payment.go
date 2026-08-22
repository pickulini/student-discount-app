package usecase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"time"
	"your-project/internal/domain"
	"your-project/internal/repository"
)

type PaymentUsecase struct {
	accountRepo repository.AccountRepository
	ledgerRepo  repository.LedgerRepository
	bonusRepo   repository.BonusRepository
	paymentRepo repository.PaymentRepository
}

func NewPaymentUsecase(
	accountRepo repository.AccountRepository,
	ledgerRepo repository.LedgerRepository,
	bonusRepo repository.BonusRepository,
	paymentRepo repository.PaymentRepository,
) *PaymentUsecase {
	return &PaymentUsecase{
		accountRepo: accountRepo,
		ledgerRepo:  ledgerRepo,
		bonusRepo:   bonusRepo,
		paymentRepo: paymentRepo,
	}
}

type DepositInput struct {
	UserID int64
	Amount float64
}

func (u *PaymentUsecase) Deposit(ctx context.Context, input DepositInput) (int64, error) {
	if input.Amount <= 0 {
		return 0, errors.New("amount must be positive")
	}

	b := make([]byte, 16)
	rand.Read(b)
	idempotencyKey := fmt.Sprintf("%d-%x", input.UserID, b)

	existing, _ := u.paymentRepo.GetByIdempotencyKey(ctx, idempotencyKey)
	if existing != nil {
		if existing.Status == "succeeded" {
			return existing.ID, nil
		}
		return 0, errors.New("payment already in progress")
	}

	payment := &domain.Payment{
		UserID:         input.UserID,
		Amount:         input.Amount,
		Currency:       "RUB",
		Provider:       "sbp",
		Status:         "pending",
		IdempotencyKey: idempotencyKey,
	}
	if err := u.paymentRepo.Create(ctx, payment); err != nil {
		return 0, err
	}

	log.Printf("Initiated payment %d for user %d, amount %.2f", payment.ID, input.UserID, input.Amount)
	return payment.ID, nil
}

func (u *PaymentUsecase) CompletePayment(ctx context.Context, paymentID int64) error {
	payment, err := u.paymentRepo.GetByID(ctx, paymentID)
	if err != nil {
		return err
	}
	if payment.Status != "pending" {
		return errors.New("payment already processed")
	}
	return u.processSuccessfulPayment(ctx, payment)
}

// ConfirmPayment – устаревший, оставляем для совместимости, но можно удалить
func (u *PaymentUsecase) ConfirmPayment(ctx context.Context, paymentID int64) error {
	return u.CompletePayment(ctx, paymentID)
}

func (u *PaymentUsecase) ProcessWebhook(ctx context.Context, paymentID int64, status string) error {
	payment, err := u.paymentRepo.GetByID(ctx, paymentID)
	if err != nil {
		return err
	}
	if payment.Status != "pending" {
		return errors.New("payment already processed")
	}
	if status == "succeeded" {
		return u.processSuccessfulPayment(ctx, payment)
	} else if status == "failed" {
		return u.paymentRepo.UpdateStatus(ctx, paymentID, "failed", nil, nil)
	}
	return errors.New("unknown status")
}

func (u *PaymentUsecase) processSuccessfulPayment(ctx context.Context, payment *domain.Payment) error {
	now := time.Now()
	externalID := "sbp_" + hex.EncodeToString([]byte(fmt.Sprintf("%d", payment.ID)))

	if err := u.paymentRepo.UpdateStatus(ctx, payment.ID, "succeeded", &externalID, &now); err != nil {
		return err
	}

	account, err := u.accountRepo.GetByUserIDAndType(ctx, payment.UserID, "cash")
	if err != nil {
		return err
	}

	idempotencyKey := generatePaymentIdempotencyKey(payment.UserID, payment.ID)
	ledgerTx := &domain.LedgerTransaction{
		Type:           "deposit",
		Status:         "pending",
		IdempotencyKey: idempotencyKey,
		ReferenceType:  "payment",
		ReferenceID:    payment.ID,
		Description:    "Пополнение баланса через СБП",
	}
	if err := u.ledgerRepo.CreateTransaction(ctx, ledgerTx); err != nil {
		return err
	}

	entry := &domain.LedgerEntry{
		TransactionID: ledgerTx.ID,
		AccountID:     account.ID,
		Amount:        payment.Amount,
	}
	if err := u.ledgerRepo.CreateEntry(ctx, entry); err != nil {
		return err
	}

	newBalance := account.Balance + payment.Amount
	if err := u.accountRepo.UpdateBalance(ctx, account.ID, newBalance); err != nil {
		return err
	}

	if err := u.ledgerRepo.UpdateTransactionStatus(ctx, ledgerTx.ID, "completed"); err != nil {
		return err
	}

	log.Printf("Payment %d completed for user %d, amount %.2f", payment.ID, payment.UserID, payment.Amount)
	return nil
}

func generatePaymentIdempotencyKey(userID, paymentID int64) string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%d-%d-%x", userID, paymentID, b)
}

func (u *PaymentUsecase) GetPaymentByID(ctx context.Context, id int64) (*domain.Payment, error) {
	return u.paymentRepo.GetByID(ctx, id)
}
