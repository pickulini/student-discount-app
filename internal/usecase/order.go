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
)

type OrderUsecase struct {
    orderRepo   repository.OrderRepository
    offerRepo   repository.OfferRepository
    userRepo    repository.UserRepository
    accountRepo repository.AccountRepository
    ledgerRepo  repository.LedgerRepository
    bonusRepo   repository.BonusRepository
}

func NewOrderUsecase(
    orderRepo repository.OrderRepository,
    offerRepo repository.OfferRepository,
    userRepo repository.UserRepository,
    accountRepo repository.AccountRepository,
    ledgerRepo repository.LedgerRepository,
    bonusRepo repository.BonusRepository,
) *OrderUsecase {
    return &OrderUsecase{
        orderRepo:   orderRepo,
        offerRepo:   offerRepo,
        userRepo:    userRepo,
        accountRepo: accountRepo,
        ledgerRepo:  ledgerRepo,
        bonusRepo:   bonusRepo,
    }
}

type CreateOrderInput struct {
    UserID      int64
    OfferID     int64
    LocationID  *int64
    BonusPoints float64
}

func (u *OrderUsecase) CreateOrder(ctx context.Context, input CreateOrderInput) (*domain.Order, error) {
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

    account, err := u.accountRepo.GetByUserIDAndType(ctx, input.UserID, "cash")
    if err != nil {
        return nil, errors.New("account not found")
    }

    bonusAcc, err := u.bonusRepo.GetByUserID(ctx, input.UserID)
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
        Status:         "created",
        CreatedAt:      time.Now(),
    }

    if err := u.orderRepo.Create(ctx, order); err != nil {
        return nil, err
    }

    idempotencyKey := generateIdempotencyKey(input.UserID, input.OfferID)

    ledgerTx := &domain.LedgerTransaction{
        Type:           "purchase",
        Status:         "pending",
        IdempotencyKey: idempotencyKey,
        ReferenceType:  "order",
        ReferenceID:    order.ID,
        Description:    "Оплата заказа",
    }
    if err := u.ledgerRepo.CreateTransaction(ctx, ledgerTx); err != nil {
        return nil, err
    }

    entry := &domain.LedgerEntry{
        TransactionID: ledgerTx.ID,
        AccountID:     account.ID,
        Amount:        -total,
    }
    if err := u.ledgerRepo.CreateEntry(ctx, entry); err != nil {
        return nil, err
    }

    newBalance := account.Balance - total
    if err := u.accountRepo.UpdateBalance(ctx, account.ID, newBalance); err != nil {
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
        if err := u.bonusRepo.CreateTransaction(ctx, bonusTx); err != nil {
            return nil, err
        }
        newBonus := bonusAcc.Balance - bonusUsed
        if err := u.bonusRepo.UpdateBalance(ctx, bonusAcc.ID, newBonus); err != nil {
            return nil, err
        }
    }

    if err := u.ledgerRepo.UpdateTransactionStatus(ctx, ledgerTx.ID, "completed"); err != nil {
        return nil, err
    }

    u.offerRepo.IncrementUses(ctx, offer.ID)

    return order, nil
}

func (u *OrderUsecase) GetUserOrders(ctx context.Context, userID int64) ([]domain.Order, error) {
    return u.orderRepo.GetByUserID(ctx, userID)
}

func generateIdempotencyKey(userID, offerID int64) string {
    b := make([]byte, 16)
    rand.Read(b)
    return fmt.Sprintf("%d-%d-%x", userID, offerID, b)
}
