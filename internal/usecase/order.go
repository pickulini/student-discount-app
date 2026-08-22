package usecase

import (
    "context"
    "crypto/rand"
    "errors"
    "fmt"
    "math"
    "time"
    "your-project/internal/domain"
    "your-project/internal/repository"
    "github.com/jackc/pgx/v5/pgxpool"
)

type OrderUsecase struct {
    orderRepo   repository.OrderRepository
    offerRepo   repository.OfferRepository
    userRepo    repository.UserRepository
    accountRepo repository.AccountRepository
    ledgerRepo  repository.LedgerRepository
    bonusRepo   repository.BonusRepository
    db          *pgxpool.Pool
}

func NewOrderUsecase(
    orderRepo repository.OrderRepository,
    offerRepo repository.OfferRepository,
    userRepo repository.UserRepository,
    accountRepo repository.AccountRepository,
    ledgerRepo repository.LedgerRepository,
    bonusRepo repository.BonusRepository,
    db *pgxpool.Pool,
) *OrderUsecase {
    return &OrderUsecase{
        orderRepo:   orderRepo,
        offerRepo:   offerRepo,
        userRepo:    userRepo,
        accountRepo: accountRepo,
        ledgerRepo:  ledgerRepo,
        bonusRepo:   bonusRepo,
        db:          db,
    }
}

type CreateOrderInput struct {
    UserID      int64
    OfferID     int64
    LocationID  *int64
    BonusPoints float64
}

func (u *OrderUsecase) CreateOrder(ctx context.Context, input CreateOrderInput) (*domain.Order, error) {
    // Начинаем транзакцию
    tx, err := u.db.Begin(ctx)
    if err != nil {
        return nil, err
    }
    defer tx.Rollback(ctx)

    // 1. Получаем предложение (без транзакции, т.к. только чтение)
    offer, err := u.offerRepo.GetByID(ctx, input.OfferID)
    if err != nil {
        return nil, errors.New("offer not found")
    }
    if offer.Status != "published" {
        return nil, errors.New("offer not available")
    }
    if time.Now().After(offer.EndAt) {
        return nil, errors.New("offer expired")
    }

    // 2. Получаем счёт с блокировкой
    account, err := u.accountRepo.GetByUserIDAndTypeTx(ctx, tx, input.UserID, "cash")
    if err != nil {
        return nil, errors.New("account not found")
    }

    // 3. Получаем бонусный счёт с блокировкой
    bonusAcc, err := u.bonusRepo.GetByUserIDTx(ctx, tx, input.UserID)
    if err != nil {
        return nil, errors.New("bonus account not found")
    }

    // 4. Расчёт
    subtotal := 1000.0
    discount := 0.0
    if offer.DiscountType == "percentage" {
        discount = subtotal * (offer.DiscountValue / 100)
    } else {
        discount = offer.DiscountValue
    }
    afterDiscount := subtotal - discount

    maxBonusPercent := 20
    if offer.MaxBonusPercent > 0 {
        maxBonusPercent = offer.MaxBonusPercent
    }
    maxBonus := afterDiscount * float64(maxBonusPercent) / 100
    bonusUsed := math.Min(input.BonusPoints, maxBonus)
    if bonusUsed > bonusAcc.Balance {
        bonusUsed = bonusAcc.Balance
    }

    total := afterDiscount - bonusUsed
    commission := total * 0.02

    if total > account.Balance {
        return nil, domain.ErrInsufficientBalance
    }

    // 5. Создаём заказ
    order := &domain.Order{
        UserID:         input.UserID,
        CompanyID:      offer.CompanyID,
        OfferID:        input.OfferID,
        LocationID:     input.LocationID,
        Subtotal:       subtotal,
        DiscountAmount: discount,
        BonusAmount:    bonusUsed,
        TotalAmount:    total,
        Commission:     commission,
        Status:         "created",
        CreatedAt:      time.Now(),
    }
    if err := u.orderRepo.CreateTx(ctx, tx, order); err != nil {
        return nil, err
    }

    // 6. Ledger транзакция
    idempotencyKey := generateOrderIdempotencyKey(input.UserID, input.OfferID)
    ledgerTx := &domain.LedgerTransaction{
        Type:           "purchase",
        Status:         "pending",
        IdempotencyKey: idempotencyKey,
        ReferenceType:  "order",
        ReferenceID:    order.ID,
        Description:    "Оплата заказа",
    }
    if err := u.ledgerRepo.CreateTransactionTx(ctx, tx, ledgerTx); err != nil {
        return nil, err
    }

    // 7. Ledger entry
    entry := &domain.LedgerEntry{
        TransactionID: ledgerTx.ID,
        AccountID:     account.ID,
        Amount:        -total,
    }
    if err := u.ledgerRepo.CreateEntryTx(ctx, tx, entry); err != nil {
        return nil, err
    }

    // 8. Обновляем баланс счёта
    newBalance := account.Balance - total
    if err := u.accountRepo.UpdateBalanceTx(ctx, tx, account.ID, newBalance); err != nil {
        return nil, err
    }

    // 9. Бонусы
    if bonusUsed > 0 {
        bonusTx := &domain.BonusTransaction{
            UserID:        input.UserID,
            Amount:        -bonusUsed,
            Type:          "spend",
            ReferenceType: "order",
            ReferenceID:   order.ID,
        }
        if err := u.bonusRepo.CreateTransactionTx(ctx, tx, bonusTx); err != nil {
            return nil, err
        }
        newBonus := bonusAcc.Balance - bonusUsed
        if err := u.bonusRepo.UpdateBalanceTx(ctx, tx, bonusAcc.ID, newBonus); err != nil {
            return nil, err
        }
    }

    // 10. Завершаем ledger
    if err := u.ledgerRepo.UpdateTransactionStatusTx(ctx, tx, ledgerTx.ID, "completed"); err != nil {
        return nil, err
    }

    // 11. Увеличиваем счётчик использований
    if err := u.offerRepo.IncrementUsesTx(ctx, tx, offer.ID); err != nil {
        return nil, err
    }

    // Фиксируем транзакцию
    if err := tx.Commit(ctx); err != nil {
        return nil, err
    }

    return order, nil
}

func (u *OrderUsecase) GetUserOrders(ctx context.Context, userID int64) ([]domain.Order, error) {
    return u.orderRepo.GetByUserID(ctx, userID)
}

func generateOrderIdempotencyKey(userID, offerID int64) string {
    b := make([]byte, 16)
    rand.Read(b)
    return fmt.Sprintf("order-%d-%d-%x", userID, offerID, b)
}
