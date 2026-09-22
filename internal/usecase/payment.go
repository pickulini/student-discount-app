package usecase

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"strconv"
	"time"
	"your-project/internal/domain"
	"your-project/internal/repository"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PaymentUsecase struct {
	accountRepo   repository.AccountRepository
	ledgerRepo    repository.LedgerRepository
	bonusRepo     repository.BonusRepository
	paymentRepo   repository.PaymentRepository
	db            *pgxpool.Pool
	webhookSecret []byte
}

func NewPaymentUsecase(
	accountRepo repository.AccountRepository,
	ledgerRepo repository.LedgerRepository,
	bonusRepo repository.BonusRepository,
	paymentRepo repository.PaymentRepository,
	db *pgxpool.Pool,
	webhookSecret string,
) *PaymentUsecase {
	return &PaymentUsecase{
		accountRepo:   accountRepo,
		ledgerRepo:    ledgerRepo,
		bonusRepo:     bonusRepo,
		paymentRepo:   paymentRepo,
		db:            db,
		webhookSecret: []byte(webhookSecret),
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

// GenerateCheckoutToken returns an unguessable, per-payment token that authorizes access to
// the (unauthenticated, full-page-redirect) SBP checkout/confirm page for this one payment.
// Without it, anyone who can guess a sequential payment ID could confirm someone else's payment.
func (u *PaymentUsecase) GenerateCheckoutToken(paymentID int64) string {
	mac := hmac.New(sha256.New, u.webhookSecret)
	mac.Write([]byte("checkout:" + strconv.FormatInt(paymentID, 10)))
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifyCheckoutToken checks a token produced by GenerateCheckoutToken in constant time.
func (u *PaymentUsecase) VerifyCheckoutToken(paymentID int64, token string) bool {
	expected := u.GenerateCheckoutToken(paymentID)
	return subtle.ConstantTimeCompare([]byte(expected), []byte(token)) == 1
}

// VerifyWebhookSignature validates an HMAC-SHA256 signature (hex-encoded) over the raw webhook
// body. Real payment providers sign their webhook payloads this way; without this check, anyone
// could POST a fake "succeeded" webhook and credit an arbitrary balance.
func (u *PaymentUsecase) VerifyWebhookSignature(body []byte, signatureHex string) bool {
	if signatureHex == "" {
		return false
	}
	mac := hmac.New(sha256.New, u.webhookSecret)
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return subtle.ConstantTimeCompare([]byte(expected), []byte(signatureHex)) == 1
}

func (u *PaymentUsecase) CompletePayment(ctx context.Context, paymentID int64) error {
	return u.withLockedPendingPayment(ctx, paymentID, func(ctx context.Context, tx pgx.Tx, payment *domain.Payment) error {
		return u.processSuccessfulPaymentTx(ctx, tx, payment)
	})
}

// ConfirmPayment – устаревший, оставляем для совместимости, но можно удалить
func (u *PaymentUsecase) ConfirmPayment(ctx context.Context, paymentID int64) error {
	return u.CompletePayment(ctx, paymentID)
}

func (u *PaymentUsecase) ProcessWebhook(ctx context.Context, paymentID int64, status string) error {
	if status != "succeeded" && status != "failed" {
		return errors.New("unknown status")
	}
	return u.withLockedPendingPayment(ctx, paymentID, func(ctx context.Context, tx pgx.Tx, payment *domain.Payment) error {
		if status == "succeeded" {
			return u.processSuccessfulPaymentTx(ctx, tx, payment)
		}
		return u.paymentRepo.UpdateStatusTx(ctx, tx, paymentID, "failed", nil, nil)
	})
}

// withLockedPendingPayment opens a transaction, locks the payment row (SELECT ... FOR UPDATE)
// and re-checks that it's still "pending" before calling fn. This closes a race where two
// concurrent webhook/confirm requests for the same payment could both pass a plain
// GetByID+status-check and double-credit the account.
func (u *PaymentUsecase) withLockedPendingPayment(ctx context.Context, paymentID int64, fn func(ctx context.Context, tx pgx.Tx, payment *domain.Payment) error) error {
	tx, err := u.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	payment, err := u.paymentRepo.GetByIDForUpdateTx(ctx, tx, paymentID)
	if err != nil {
		return err
	}
	if payment.Status != "pending" {
		return errors.New("payment already processed")
	}

	if err := fn(ctx, tx, payment); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (u *PaymentUsecase) processSuccessfulPaymentTx(ctx context.Context, tx pgx.Tx, payment *domain.Payment) error {
	now := time.Now()
	externalID := "sbp_" + hex.EncodeToString([]byte(fmt.Sprintf("%d", payment.ID)))

	if err := u.paymentRepo.UpdateStatusTx(ctx, tx, payment.ID, "succeeded", &externalID, &now); err != nil {
		return err
	}

	account, err := u.accountRepo.GetByUserIDAndTypeTx(ctx, tx, payment.UserID, "cash")
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
	if err := u.ledgerRepo.CreateTransactionTx(ctx, tx, ledgerTx); err != nil {
		return err
	}

	entry := &domain.LedgerEntry{
		TransactionID: ledgerTx.ID,
		AccountID:     account.ID,
		Amount:        payment.Amount,
	}
	if err := u.ledgerRepo.CreateEntryTx(ctx, tx, entry); err != nil {
		return err
	}

	newBalance := account.Balance + payment.Amount
	if err := u.accountRepo.UpdateBalanceTx(ctx, tx, account.ID, newBalance); err != nil {
		return err
	}

	if err := u.ledgerRepo.UpdateTransactionStatusTx(ctx, tx, ledgerTx.ID, "completed"); err != nil {
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
