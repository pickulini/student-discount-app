package usecase

import (
    "context"
    "log"
    "strings"
    "your-project/internal/domain"
    "your-project/internal/repository"
    "your-project/internal/util"
    "github.com/jackc/pgx/v5/pgxpool"
)

type MerchantUsecase struct {
    companyRepo      repository.CompanyRepository
    locationRepo     repository.LocationRepository
    offerRepo        repository.OfferRepository
    companyUserRepo  repository.CompanyUserRepository
    userRepo         repository.UserRepository
    merchantAccRepo  repository.MerchantAccountRepository
    merchantTxRepo   repository.MerchantTransactionRepository
    tagRepo          repository.TagRepository
    notifUC          *NotificationUsecase
    db               *pgxpool.Pool
}

func NewMerchantUsecase(
    companyRepo repository.CompanyRepository,
    locationRepo repository.LocationRepository,
    offerRepo repository.OfferRepository,
    companyUserRepo repository.CompanyUserRepository,
    userRepo repository.UserRepository,
    merchantAccRepo repository.MerchantAccountRepository,
    merchantTxRepo repository.MerchantTransactionRepository,
    tagRepo repository.TagRepository,
    notifUC *NotificationUsecase,
    db *pgxpool.Pool,
) *MerchantUsecase {
    return &MerchantUsecase{
        companyRepo:     companyRepo,
        locationRepo:    locationRepo,
        offerRepo:       offerRepo,
        companyUserRepo: companyUserRepo,
        userRepo:        userRepo,
        merchantAccRepo: merchantAccRepo,
        merchantTxRepo:  merchantTxRepo,
        tagRepo:         tagRepo,
        notifUC:         notifUC,
        db:              db,
    }
}

func (u *MerchantUsecase) GetUserCompanies(ctx context.Context, userID int64) ([]domain.Company, error) {
    companyUsers, err := u.companyUserRepo.GetByUserID(ctx, userID)
    if err != nil {
        return nil, err
    }
    if len(companyUsers) == 0 {
        return []domain.Company{}, nil
    }
    var companies []domain.Company
    for _, cu := range companyUsers {
        c, err := u.companyRepo.GetByID(ctx, cu.CompanyID)
        if err != nil {
            return nil, err
        }
        companies = append(companies, *c)
    }
    return companies, nil
}

func (u *MerchantUsecase) GetUserOffers(ctx context.Context, userID int64) ([]domain.Offer, error) {
    companies, err := u.GetUserCompanies(ctx, userID)
    if err != nil {
        return nil, err
    }
    if len(companies) == 0 {
        return []domain.Offer{}, nil
    }
    var offers []domain.Offer
    for _, c := range companies {
        opts, err := u.offerRepo.GetByCompanyID(ctx, c.ID)
        if err != nil {
            return nil, err
        }
        offers = append(offers, opts...)
    }
    return offers, nil
}

func (u *MerchantUsecase) CreateOffer(ctx context.Context, userID int64, offer *domain.Offer, hashtags []string) error {
    companyUsers, err := u.companyUserRepo.GetByUserID(ctx, userID)
    if err != nil {
        return err
    }
    found := false
    for _, cu := range companyUsers {
        if offer.CompanyID != nil && cu.CompanyID == *offer.CompanyID {
            found = true
            break
        }
    }
    if !found {
        return domain.ErrUnauthorized
    }
    offer.Status = "draft"
    if err := u.offerRepo.Create(ctx, offer); err != nil {
        log.Printf("CreateOffer: offerRepo.Create error: %v", err)
        return err
    }
    if len(hashtags) > 0 {
        if err := u.resolveAndSetTags(ctx, offer.ID, hashtags, userID); err != nil {
            log.Printf("CreateOffer: resolveAndSetTags error: %v", err)
            return err
        }
    }
    return nil
}

// resolveAndSetTags парсит хештеги, upsert-ит теги (pending) и привязывает к офферу.
func (u *MerchantUsecase) resolveAndSetTags(ctx context.Context, offerID int64, hashtags []string, userID int64) error {
    seen := make(map[string]bool)
    var tagIDs []int64

    for _, raw := range hashtags {
        clean := strings.TrimSpace(strings.TrimLeft(raw, "#@"))
        if clean == "" {
            continue
        }
        slug := util.SlugifyUsername(clean)
        if slug == "" {
            continue
        }
        if seen[slug] {
            continue
        }
        seen[slug] = true

        tag, err := u.tagRepo.Upsert(ctx, clean, slug, &userID)
        if err != nil {
            return err
        }
        tagIDs = append(tagIDs, tag.ID)
        if len(tagIDs) >= 10 {
            break
        }
    }
    return u.tagRepo.SetOfferTags(ctx, offerID, tagIDs)
}

func (u *MerchantUsecase) SubmitForReview(ctx context.Context, userID, offerID int64) error {
    offer, err := u.offerRepo.GetByID(ctx, offerID)
    if err != nil {
        return err
    }
    companyUsers, err := u.companyUserRepo.GetByUserID(ctx, userID)
    if err != nil {
        return err
    }
    found := false
    for _, cu := range companyUsers {
        if offer.CompanyID != nil && cu.CompanyID == *offer.CompanyID {
            found = true
            break
        }
    }
    if !found {
        return domain.ErrUnauthorized
    }
    if offer.Status != "draft" {
        return domain.ErrInvalidStatus
    }
    if err := u.offerRepo.UpdateStatus(ctx, offerID, "pending_review"); err != nil {
        return err
    }
    if u.notifUC != nil {
        _ = u.notifUC.NotifyAdmins(ctx, CreateNotificationInput{
            Type:          "offer_pending_review",
            Title:         "На модерацию: " + offer.Title,
            Link:          "/admin/offers",
            ReferenceType: "offer",
            ReferenceID:   &offerID,
        })
        u.notifUC.BroadcastAdminEvent("offer_pending_review", map[string]interface{}{
            "offer_id": offerID,
            "title":    offer.Title,
        })
    }
    return nil
}

func (u *MerchantUsecase) GetDailyStats(ctx context.Context, userID int64, days int) (interface{}, error) {
    // Заглушка – возвращаем демо-данные
    return map[string]interface{}{
        "daily": []map[string]interface{}{
            {"date": "2026-08-15", "orders": 0, "revenue": 0},
            {"date": "2026-08-16", "orders": 0, "revenue": 0},
        },
    }, nil
}

// ---- Новые методы для баланса и транзакций ----

func (u *MerchantUsecase) GetBalance(ctx context.Context, userID int64) (map[string]interface{}, error) {
    companies, err := u.GetUserCompanies(ctx, userID)
    if err != nil {
        return nil, err
    }
    if len(companies) == 0 {
        return map[string]interface{}{
            "balance": 0,
            "companies": []interface{}{},
        }, nil
    }
    var totalBalance float64
    var companyBalances []map[string]interface{}
    for _, c := range companies {
        acc, err := u.merchantAccRepo.GetByCompanyID(ctx, c.ID)
        if err != nil {
            // если счёта нет, считаем баланс 0
            companyBalances = append(companyBalances, map[string]interface{}{
                "company_id": c.ID,
                "company_name": c.Name,
                "balance": 0,
            })
            continue
        }
        totalBalance += acc.Balance
        companyBalances = append(companyBalances, map[string]interface{}{
            "company_id": c.ID,
            "company_name": c.Name,
            "balance": acc.Balance,
        })
    }
    return map[string]interface{}{
        "total_balance": totalBalance,
        "companies": companyBalances,
    }, nil
}

func (u *MerchantUsecase) GetTransactions(ctx context.Context, userID int64, limit, offset int) ([]domain.MerchantTransaction, error) {
    companies, err := u.GetUserCompanies(ctx, userID)
    if err != nil {
        return nil, err
    }
    if len(companies) == 0 {
        return []domain.MerchantTransaction{}, nil
    }
    // Собираем транзакции по всем компаниям (простейший способ – по очереди)
    // В реальном проекте лучше сделать один запрос с JOIN.
    var allTx []domain.MerchantTransaction
    for _, c := range companies {
        tx, err := u.merchantTxRepo.GetByCompanyID(ctx, c.ID)
        if err != nil {
            continue
        }
        allTx = append(allTx, tx...)
    }
    // Сортируем по убыванию created_at (простейшая сортировка)
    // В реальном проекте лучше сделать сортировку в БД.
    // Для MVP просто вернём все.
    return allTx, nil
}

// UpdateOffer обновляет предложение партнёра. Если было опубликовано — уходит на повторную модерацию.
func (u *MerchantUsecase) UpdateOffer(ctx context.Context, userID, offerID int64, updated *domain.Offer, hashtags []string) error {
    offer, err := u.offerRepo.GetByID(ctx, offerID)
    if err != nil {
        return domain.ErrUserNotFound
    }

    // Проверяем права: партнёр должен быть привязан к компании этого предложения
    companyUsers, err := u.companyUserRepo.GetByUserID(ctx, userID)
    if err != nil {
        return err
    }
    found := false
    for _, cu := range companyUsers {
        if offer.CompanyID != nil && cu.CompanyID == *offer.CompanyID {
            found = true
            break
        }
    }
    if !found {
        return domain.ErrUnauthorized
    }

    // Обновляем поля
    offer.Title = updated.Title
    offer.Description = updated.Description
    offer.DiscountType = updated.DiscountType
    offer.DiscountValue = updated.DiscountValue
    offer.StartAt = updated.StartAt
    offer.EndAt = updated.EndAt
    offer.BonusAllowed = updated.BonusAllowed
    offer.MaxBonusPercent = updated.MaxBonusPercent
    offer.ImageURL = updated.ImageURL
    offer.Address = updated.Address
    offer.Phone = updated.Phone
    offer.Website = updated.Website
    offer.WorkingHours = updated.WorkingHours

    // Если было опубликовано или отклонено — уходит на повторную модерацию
    if offer.Status == "published" || offer.Status == "rejected" || offer.Status == "archived" {
        offer.Status = "pending_review"
        offer.RejectionReason = nil
    }

    if err := u.offerRepo.Update(ctx, offer); err != nil {
        return err
    }

    if hashtags != nil {
        if err := u.resolveAndSetTags(ctx, offerID, hashtags, userID); err != nil {
            return err
        }
    }

    return nil
}
