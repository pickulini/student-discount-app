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
    orderRepo           repository.OrderRepository
    offerRepo           repository.OfferRepository
    userRepo            repository.UserRepository
    accountRepo         repository.AccountRepository
    ledgerRepo          repository.LedgerRepository
    bonusRepo           repository.BonusRepository
    merchantAccountRepo repository.MerchantAccountRepository
    merchantTxRepo      repository.MerchantTransactionRepository
    db                  *pgxpool.Pool
}

func NewOrderUsecase(
    orderRepo repository.OrderRepository,
    offerRepo repository.OfferRepository,
    userRepo repository.UserRepository,
    accountRepo repository.AccountRepository,
    ledgerRepo repository.LedgerRepository,
    bonusRepo repository.BonusRepository,
    merchantAccountRepo repository.MerchantAccountRepository,
    merchantTxRepo repository.MerchantTransactionRepository,
    db *pgxpool.Pool,
) *OrderUsecase {
    return &OrderUsecase{
        orderRepo:           orderRepo,
        offerRepo:           offerRepo,
        userRepo:            userRepo,
        accountRepo:         accountRepo,
        ledgerRepo:          ledgerRepo,
        bonusRepo:           bonusRepo,
        merchantAccountRepo: merchantAccountRepo,
        merchantTxRepo:      merchantTxRepo,
        db:                  db,
    }
}

type CreateOrderInput struct {
    UserID      int64
    OfferID     int64
    LocationID  *int64
    BonusPoints float64
}

func (u *OrderUsecase) CreateOrder(ctx context.Context, input CreateOrderInput) (*domain.Order, error) {
    tx, err := u.db.Begin(ctx)
    if err != nil {
        return nil, err
    }
    defer tx.Rollback(ctx)

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

    account, err := u.accountRepo.GetByUserIDAndTypeTx(ctx, tx, input.UserID, "cash")
    if err != nil {
        return nil, errors.New("account not found")
    }

    bonusAcc, err := u.bonusRepo.GetByUserIDTx(ctx, tx, input.UserID)
    if err != nil {
        return nil, errors.New("bonus account not found")
    }

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
        Status:         domain.OrderStatusCreated,
        CreatedAt:      time.Now(),
    }
    if err := u.orderRepo.CreateTx(ctx, tx, order); err != nil {
        return nil, err
    }

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

    entry := &domain.LedgerEntry{
        TransactionID: ledgerTx.ID,
        AccountID:     account.ID,
        Amount:        -total,
    }
    if err := u.ledgerRepo.CreateEntryTx(ctx, tx, entry); err != nil {
        return nil, err
    }

    newBalance := account.Balance - total
    if err := u.accountRepo.UpdateBalanceTx(ctx, tx, account.ID, newBalance); err != nil {
        return nil, err
    }

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

    if err := u.ledgerRepo.UpdateTransactionStatusTx(ctx, tx, ledgerTx.ID, "completed"); err != nil {
        return nil, err
    }

    if err := u.offerRepo.IncrementUsesTx(ctx, tx, offer.ID); err != nil {
        return nil, err
    }

    merchantAmount := total - commission
    merchantAcc, err := u.merchantAccountRepo.GetByCompanyIDTx(ctx, tx, offer.CompanyID)
    if err != nil {
        merchantAcc = &domain.MerchantAccount{
            CompanyID: offer.CompanyID,
            Balance:   0,
            Currency:  "RUB",
        }
        if err := u.merchantAccountRepo.Create(ctx, merchantAcc); err != nil {
            return nil, err
        }
    }
    newMerchantBalance := merchantAcc.Balance + merchantAmount
    if err := u.merchantAccountRepo.UpdateBalanceTx(ctx, tx, merchantAcc.ID, newMerchantBalance); err != nil {
        return nil, err
    }

    merchantTx := &domain.MerchantTransaction{
        CompanyID:   offer.CompanyID,
        OrderID:     &order.ID,
        Amount:      merchantAmount,
        Type:        "order_earning",
        Status:      "completed",
        Description: "Заработок по заказу",
    }
    if err := u.merchantTxRepo.CreateTx(ctx, tx, merchantTx); err != nil {
        return nil, err
    }

    if err := tx.Commit(ctx); err != nil {
        return nil, err
    }

    return order, nil
}

func (u *OrderUsecase) GetUserOrders(ctx context.Context, userID int64) ([]domain.Order, error) {
    return u.orderRepo.GetByUserID(ctx, userID)
}

// UpdateOrderStatus обновляет статус заказа с проверкой допустимости перехода
func (u *OrderUsecase) UpdateOrderStatus(ctx context.Context, orderID int64, newStatus string) error {
    order, err := u.orderRepo.GetByID(ctx, orderID)
    if err != nil {
        return errors.New("order not found")
    }

    if !domain.IsValidOrderTransition(order.Status, newStatus) {
        return fmt.Errorf("invalid status transition: %s -> %s", order.Status, newStatus)
    }

    return u.orderRepo.UpdateStatus(ctx, orderID, newStatus)
}

// CancelOrder отменяет заказ – ТОЛЬКО если статус created
func (u *OrderUsecase) CancelOrder(ctx context.Context, orderID int64) error {
    order, err := u.orderRepo.GetByID(ctx, orderID)
    if err != nil {
        return errors.New("order not found")
    }

    // Отмена разрешена только для created
    if order.Status != domain.OrderStatusCreated {
        return errors.New("order cannot be cancelled in current status")
    }

    return u.orderRepo.UpdateStatus(ctx, orderID, domain.OrderStatusCancelled)
}

func generateOrderIdempotencyKey(userID, offerID int64) string {
    b := make([]byte, 16)
    rand.Read(b)
    return fmt.Sprintf("order-%d-%d-%x", userID, offerID, b)
}
