package usecase

import (
    "context"
    "errors"
    "encoding/json"
    "log"
    "time"
    "your-project/internal/domain"
    "your-project/internal/repository"
    "github.com/jackc/pgx/v5/pgxpool"
)

type AdminUsecase struct {
    userRepo         repository.UserRepository
    companyRepo      repository.CompanyRepository
    locationRepo     repository.LocationRepository
    offerRepo        repository.OfferRepository
    verificationRepo repository.StudentVerificationRepository
    accountRepo      repository.AccountRepository
    bonusRepo        repository.BonusRepository
    referralRepo     repository.ReferralRepository
    tagRepo          repository.TagRepository
    companyUserRepo  repository.CompanyUserRepository
    notifUC          *NotificationUsecase
    subRepo          repository.CompanySubscriptionRepository
    db               *pgxpool.Pool
}

func NewAdminUsecase(
    userRepo repository.UserRepository,
    companyRepo repository.CompanyRepository,
    locationRepo repository.LocationRepository,
    offerRepo repository.OfferRepository,
    verificationRepo repository.StudentVerificationRepository,
    accountRepo repository.AccountRepository,
    bonusRepo repository.BonusRepository,
    referralRepo repository.ReferralRepository,
    tagRepo repository.TagRepository,
    companyUserRepo repository.CompanyUserRepository,
    notifUC *NotificationUsecase,
    subRepo repository.CompanySubscriptionRepository,
    db *pgxpool.Pool,
) *AdminUsecase {
    return &AdminUsecase{
        userRepo:         userRepo,
        companyRepo:      companyRepo,
        locationRepo:     locationRepo,
        offerRepo:        offerRepo,
        verificationRepo: verificationRepo,
        accountRepo:      accountRepo,
        bonusRepo:        bonusRepo,
        referralRepo:     referralRepo,
        tagRepo:          tagRepo,
        companyUserRepo:  companyUserRepo,
        notifUC:          notifUC,
        subRepo:          subRepo,
        db:               db,
    }
}

// ---- Пользователи ----
func (u *AdminUsecase) ListUsers(ctx context.Context, limit, offset int) ([]domain.User, error) {
    query := `SELECT u.id, u.email, u.full_name, u.student_status, u.referral_code, u.is_active, u.created_at, u.updated_at,
                     COALESCE(a.balance, 0) as account_balance
              FROM users u
              LEFT JOIN accounts a ON u.id = a.user_id AND a.type = 'cash'
              ORDER BY u.id LIMIT $1 OFFSET $2`
    rows, err := u.db.Query(ctx, query, limit, offset)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var users []domain.User
    for rows.Next() {
        var u domain.User
        var accountBalance float64
        if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.StudentStatus,
            &u.ReferralCode, &u.IsActive, &u.CreatedAt, &u.UpdatedAt, &accountBalance); err != nil {
            return nil, err
        }
        u.Balance = accountBalance
        users = append(users, u)
    }
    return users, nil
}

func (u *AdminUsecase) GetUser(ctx context.Context, id int64) (*domain.User, error) {
    return u.userRepo.GetByID(ctx, id)
}

func (u *AdminUsecase) UpdateUserRole(ctx context.Context, userID int64, role string) error {
    return u.userRepo.UpdateRole(ctx, userID, role)
}

// ---- Компании ----
func (u *AdminUsecase) ListCompanies(ctx context.Context, limit, offset int) ([]domain.Company, error) {
    return u.companyRepo.List(ctx, limit, offset)
}
func (u *AdminUsecase) CreateCompany(ctx context.Context, company *domain.Company) error {
    return u.companyRepo.Create(ctx, company)
}
func (u *AdminUsecase) UpdateCompany(ctx context.Context, company *domain.Company) error {
    return u.companyRepo.Update(ctx, company)
}
func (u *AdminUsecase) DeleteCompany(ctx context.Context, id int64) error {
    return u.companyRepo.Delete(ctx, id)
}

// ---- Предложения ----
func (u *AdminUsecase) ListOffers(ctx context.Context, limit, offset int) ([]domain.Offer, error) {
    return u.offerRepo.ListAll(ctx, limit, offset)
}
func (u *AdminUsecase) CreateOffer(ctx context.Context, offer *domain.Offer, tagIDs []int64) error {
    if err := u.offerRepo.Create(ctx, offer); err != nil {
        return err
    }
    if len(tagIDs) > 0 {
        if err := u.tagRepo.SetOfferTags(ctx, offer.ID, tagIDs); err != nil {
            return err
        }
    }
    return nil
}
func (u *AdminUsecase) UpdateOffer(ctx context.Context, offer *domain.Offer, tagIDs []int64) error {
    if err := u.offerRepo.Update(ctx, offer); err != nil {
        return err
    }
    if tagIDs != nil {
        if err := u.tagRepo.SetOfferTags(ctx, offer.ID, tagIDs); err != nil {
            return err
        }
    }
    return nil
}
func (u *AdminUsecase) DeleteOffer(ctx context.Context, id int64) error {
    return u.offerRepo.Delete(ctx, id)
}
func (u *AdminUsecase) ModerateOffer(ctx context.Context, id int64, action string, reason string) error {
    if action == "publish" {
        if err := u.offerRepo.UpdateStatusWithReason(ctx, id, "published", ""); err != nil {
            return err
        }
        // Автомодерация тегов: pending → active
        if err := u.tagRepo.ActivateByOfferID(ctx, id); err != nil {
            log.Printf("failed to activate tags for offer %d: %v", id, err)
        }
        // Рассылаем уведомления подписчикам
        u.notifySubscribersAboutPublished(ctx, id)
        return nil
    } else if action == "reject" {
        if reason == "" {
            reason = "Предложение отклонено администратором"
        }
        return u.offerRepo.UpdateStatusWithReason(ctx, id, "rejected", reason)
    }
    return nil
}
func (u *AdminUsecase) ArchiveOffer(ctx context.Context, id int64) error {
    return u.offerRepo.UpdateStatus(ctx, id, "archived")
}

// ---- Верификации ----
func (u *AdminUsecase) ListVerifications(ctx context.Context, limit, offset int) ([]domain.StudentVerification, error) {
    return u.verificationRepo.List(ctx, limit, offset)
}

func (u *AdminUsecase) UpdateVerification(ctx context.Context, id int64, status string, rejectionReason string, adminID int64) error {
    // 1. Обновляем статус верификации
    if err := u.verificationRepo.UpdateStatus(ctx, id, status, adminID, rejectionReason); err != nil {
        return err
    }

    // Если статус verified — устанавливаем expires_at (30 сентября следующего года)
    if status == "verified" {
        expiresAt := calculateVerificationExpiry(time.Now())
        if err := u.verificationRepo.SetExpiresAt(ctx, id, expiresAt); err != nil {
            log.Printf("Failed to set expires_at: %v", err)
        }
    }

    // 2. Если статус стал verified
    if status == "verified" {
        log.Printf("Verification %d set to verified, processing referral rewards", id)

        // Получаем запись верификации
        verif, err := u.verificationRepo.GetByID(ctx, id)
        if err != nil {
            log.Printf("Failed to get verification: %v", err)
            return nil
        }
        // Получаем пользователя
        user, err := u.userRepo.GetByID(ctx, verif.UserID)
        if err != nil {
            log.Printf("Failed to get user: %v", err)
            return nil
        }

        log.Printf("User %d, referred_by: %v", user.ID, user.ReferredBy)

        // Обновляем статус приглашения на accepted
        if user.ReferredBy != nil {
            log.Printf("Updating invite status for user %d (referrer %d) to accepted", user.ID, *user.ReferredBy)
            if err := u.referralRepo.UpdateInviteStatus(ctx, user.ID, "accepted"); err != nil {
                log.Printf("Failed to update invite status: %v", err)
            } else {
                log.Printf("Invite status updated successfully for user %d", user.ID)
            }
        }

        // Если у пользователя есть реферер – начисляем бонус
        if user.ReferredBy != nil {
            referrerID := *user.ReferredBy

            // Проверяем, не начислен ли уже бонус
            rewards, err := u.referralRepo.GetRewardsByReferrer(ctx, referrerID)
            if err != nil {
                log.Printf("Failed to check referral rewards: %v", err)
                return nil
            }
            alreadyExists := false
            for _, rw := range rewards {
                if rw.ReferredUserID == user.ID && (rw.Status == "credited" || rw.Status == "pending") {
                    alreadyExists = true
                    break
                }
            }
            if alreadyExists {
                log.Printf("Referral reward already exists for user %d", user.ID)
                return nil
            }

            // Создаём ОТЛОЖЕННУЮ награду (pending).
            // Начисление на бонусный счёт произойдёт через 14 дней воркером.
            const bonusAmount = 100.0
            const refundWindowDays = 14

            availableAt := time.Now().Add(refundWindowDays * 24 * time.Hour)
            reward := &domain.ReferralReward{
                ReferrerID:     referrerID,
                ReferredUserID: user.ID,
                Amount:         bonusAmount,
                Status:         "pending",
                TriggerType:    "verification",
                AvailableAt:    &availableAt,
            }
            if err := u.referralRepo.CreateReward(ctx, reward); err != nil {
                log.Printf("Failed to create referral reward: %v", err)
                return nil
            }

            log.Printf("Referrer %d will receive %.2f bonus for user %d after %s (refund window)",
                referrerID, bonusAmount, user.ID, availableAt.Format(time.RFC3339))
        }
    }

    return nil
}

// ---- Статистика ----
func (u *AdminUsecase) GetStatistics(ctx context.Context) (map[string]interface{}, error) {
    var totalUsers, totalCompanies, totalOffers, totalOrders int
    var totalRevenue float64
    u.db.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&totalUsers)
    u.db.QueryRow(ctx, `SELECT COUNT(*) FROM companies`).Scan(&totalCompanies)
    u.db.QueryRow(ctx, `SELECT COUNT(*) FROM offers`).Scan(&totalOffers)
    u.db.QueryRow(ctx, `SELECT COUNT(*) FROM orders`).Scan(&totalOrders)
    u.db.QueryRow(ctx, `SELECT COALESCE(SUM(total_amount), 0) FROM orders`).Scan(&totalRevenue)
    return map[string]interface{}{
        "total_users":     totalUsers,
        "total_companies": totalCompanies,
        "total_offers":    totalOffers,
        "total_orders":    totalOrders,
        "total_revenue":   totalRevenue,
    }, nil
}

func (u *AdminUsecase) GetUserDetailedStats(ctx context.Context, userID int64) (map[string]interface{}, error) {
    user, err := u.userRepo.GetByID(ctx, userID)
    if err != nil {
        return nil, err
    }
    account, err := u.accountRepo.GetByUserIDAndType(ctx, userID, "cash")
    if err != nil {
        return nil, err
    }
    bonusAcc, err := u.bonusRepo.GetByUserID(ctx, userID)
    if err != nil {
        return nil, err
    }

    var totalDeposits, totalPurchases, totalRefunds, totalBonusEarned, totalBonusRefunded, totalBonusSpent float64
    var totalOrders, refundedOrders int

    // Пополнения
    u.db.QueryRow(ctx, `
        SELECT COALESCE(SUM(le.amount), 0) 
        FROM ledger_transactions lt 
        JOIN ledger_entries le ON lt.id = le.transaction_id 
        JOIN accounts a ON le.account_id = a.id 
        WHERE a.user_id = $1 AND lt.type = 'deposit' AND le.amount > 0
    `, userID).Scan(&totalDeposits)

    // Покупки (gross) — траты
    u.db.QueryRow(ctx, `
        SELECT COALESCE(SUM(ABS(le.amount)), 0) 
        FROM ledger_transactions lt 
        JOIN ledger_entries le ON lt.id = le.transaction_id 
        JOIN accounts a ON le.account_id = a.id 
        WHERE a.user_id = $1 AND lt.type = 'purchase' AND le.amount < 0
    `, userID).Scan(&totalPurchases)

    // Возвраты (refund) — положительные суммы, компенсирующие траты
    u.db.QueryRow(ctx, `
        SELECT COALESCE(SUM(le.amount), 0) 
        FROM ledger_transactions lt 
        JOIN ledger_entries le ON lt.id = le.transaction_id 
        JOIN accounts a ON le.account_id = a.id 
        WHERE a.user_id = $1 AND lt.type = 'refund' AND le.amount > 0
    `, userID).Scan(&totalRefunds)

    // Всего заказов и отдельно возвращённых
    u.db.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE user_id = $1`, userID).Scan(&totalOrders)
    u.db.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'refunded'`, userID).Scan(&refundedOrders)

    // Бонусы: заработано — все положительные КРОМЕ refund (это возврат потраченных, а не заработок)
    u.db.QueryRow(ctx, `
        SELECT COALESCE(SUM(amount), 0) FROM bonus_transactions 
        WHERE user_id = $1 AND amount > 0 AND type <> 'refund'
    `, userID).Scan(&totalBonusEarned)

    // Бонусы: возвращено
    u.db.QueryRow(ctx, `
        SELECT COALESCE(SUM(amount), 0) FROM bonus_transactions 
        WHERE user_id = $1 AND type = 'refund'
    `, userID).Scan(&totalBonusRefunded)

    // Бонусы: потрачено (без учёта refund, т.к. это возврат)
    u.db.QueryRow(ctx, `
        SELECT COALESCE(SUM(ABS(amount)), 0) FROM bonus_transactions 
        WHERE user_id = $1 AND amount < 0 AND type = 'spend'
    `, userID).Scan(&totalBonusSpent)

    rows, err := u.db.Query(ctx, `
        SELECT id, type, amount, description, status, created_at FROM (
            SELECT 
                lt.id,
                lt.type,
                le.amount,
                lt.description,
                lt.status,
                lt.created_at
            FROM ledger_transactions lt
            JOIN ledger_entries le ON lt.id = le.transaction_id
            JOIN accounts a ON le.account_id = a.id
            WHERE a.user_id = $1
            UNION ALL
            SELECT 
                bt.id,
                bt.type,
                bt.amount,
                'Бонусная операция' as description,
                'completed' as status,
                bt.created_at
            FROM bonus_transactions bt
            WHERE bt.user_id = $1
        ) t
        ORDER BY created_at DESC
        LIMIT 20
    `, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var transactions []map[string]interface{}
    for rows.Next() {
        var id int64
        var typ, description, status string
        var amount float64
        var createdAt time.Time
        if err := rows.Scan(&id, &typ, &amount, &description, &status, &createdAt); err != nil {
            return nil, err
        }
        transactions = append(transactions, map[string]interface{}{
            "id":          id,
            "type":        typ,
            "amount":      amount,
            "description": description,
            "status":      status,
            "created_at":  createdAt,
        })
    }

    // Загружаем заказы пользователя
    orderRows, err := u.db.Query(ctx, `
        SELECT id, company_id, offer_id, subtotal, discount_amount, bonus_amount, total_amount, commission, status, created_at
        FROM orders WHERE user_id = $1 ORDER BY id DESC LIMIT 50
    `, userID)
    if err != nil {
        return nil, err
    }
    defer orderRows.Close()
    var orders []map[string]interface{}
    for orderRows.Next() {
        var id, companyID, offerID int64
        var subtotal, discountAmount, bonusAmount, totalAmount, commission float64
        var status string
        var createdAt time.Time
        if err := orderRows.Scan(&id, &companyID, &offerID, &subtotal, &discountAmount, &bonusAmount, &totalAmount, &commission, &status, &createdAt); err != nil {
            return nil, err
        }
        orders = append(orders, map[string]interface{}{
            "id":              id,
            "company_id":      companyID,
            "offer_id":        offerID,
            "subtotal":        subtotal,
            "discount_amount": discountAmount,
            "bonus_amount":    bonusAmount,
            "total_amount":    totalAmount,
            "commission":      commission,
            "status":          status,
            "created_at":      createdAt,
        })
    }

    netPurchases := totalPurchases - totalRefunds

    return map[string]interface{}{
        "user":                 user,
        "balance":              account.Balance,
        "bonus_balance":        bonusAcc.Balance,
        "total_deposits":       totalDeposits,
        "total_purchases":      totalPurchases,
        "total_refunds":        totalRefunds,
        "net_purchases":        netPurchases,
        "total_orders":         totalOrders,
        "refunded_orders":      refundedOrders,
        "bonus_earned":         totalBonusEarned,
        "bonus_refunded":       totalBonusRefunded,
        "bonus_spent":          totalBonusSpent,
        "transactions":         transactions,
        "orders":               orders,
    }, nil
}

// calculateVerificationExpiry возвращает 30 сентября следующего года
// (или текущего, если сейчас до октября)
func calculateVerificationExpiry(now time.Time) time.Time {
    // Верификация действует до 30 сентября следующего года
    return time.Date(now.Year()+1, time.September, 30, 23, 59, 59, 0, time.UTC)
}

// notifySubscribersAboutPublished рассылает уведомления подписчикам компании-владельца оффера/ивента.
func (u *AdminUsecase) notifySubscribersAboutPublished(ctx context.Context, offerID int64) {
    if u.notifUC == nil || u.subRepo == nil {
        return
    }
    offer, err := u.offerRepo.GetByID(ctx, offerID)
    if err != nil || offer == nil {
        return
    }
    // Если у оффера нет компании — уведомлять некому (личный ивент)
    if offer.CompanyID == nil {
        return
    }

    var notifType, title string
    var link string
    if offer.IsEvent {
        notifType = domain.NotifNewEvent
        title = "Новый ивент: " + offer.Title
        link = "/events"
    } else {
        notifType = domain.NotifNewOffer
        title = "Новое предложение: " + offer.Title
        link = "/"
    }

    var companyName string
    if c, err := u.companyRepo.GetByID(ctx, *offer.CompanyID); err == nil && c != nil {
        companyName = c.Name
    }
    if companyName != "" {
        title = companyName + ": " + offer.Title
    }

    // Все подписчики компании
    subs, err := u.subRepo.ListByUser(ctx, 0) // заглушка
    _ = subs
    _ = err

    // Прямой запрос — все user_id, кто подписан на компанию
    rows, err := u.db.Query(ctx,
        `SELECT user_id FROM company_subscriptions WHERE company_id = $1`,
        *offer.CompanyID)
    if err != nil {
        log.Printf("notifySubscribers: query error: %v", err)
        return
    }
    defer rows.Close()

    for rows.Next() {
        var uid int64
        if err := rows.Scan(&uid); err != nil {
            continue
        }
        refType := "offer"
        if offer.IsEvent {
            refType = "event"
        }
        _ = u.notifUC.Create(ctx, CreateNotificationInput{
            UserID:        uid,
            Type:          notifType,
            Title:         title,
            Link:          link,
            ReferenceType: refType,
            ReferenceID:   &offerID,
        })
    }
}

// AdminEditOffer — админ редактирует оффер. Переводит в pending_partner_approval
// и уведомляет партнёра.
func (u *AdminUsecase) AdminEditOffer(ctx context.Context, offerID int64, updated *domain.Offer, comment string) error {
    // 1. Получаем исходный оффер (нужен для проверки + уведомления партнёру)
    existing, err := u.offerRepo.GetByID(ctx, offerID)
    if err != nil || existing == nil {
        return errors.New("offer not found")
    }

    // 2. Формируем JSON с изменениями (полный снимок редактируемых полей)
    snapshot := map[string]interface{}{
        "title":             updated.Title,
        "description":       updated.Description,
        "discount_type":     updated.DiscountType,
        "discount_value":    updated.DiscountValue,
        "start_at":          updated.StartAt.Format(time.RFC3339),
        "end_at":            updated.EndAt.Format(time.RFC3339),
        "bonus_allowed":     updated.BonusAllowed,
        "max_bonus_percent": updated.MaxBonusPercent,
        "address":           updated.Address,
        "phone":             updated.Phone,
        "website":           updated.Website,
        "working_hours":     updated.WorkingHours,
        "image_url":         updated.ImageURL,
    }
    if updated.MaxUses != nil {
        snapshot["max_uses"] = *updated.MaxUses
    }
    if updated.SpecialPrice != nil {
        snapshot["special_price"] = *updated.SpecialPrice
    }

    dataJSON, err := json.Marshal(snapshot)
    if err != nil {
        return err
    }

    if err := u.offerRepo.SetAdminEdits(ctx, offerID, dataJSON, comment); err != nil {
        return err
    }

    // 3. Уведомляем партнёра компании
    if u.notifUC != nil && existing.CompanyID != nil {
        partnerIDs, _ := u.companyUserRepo.GetByCompanyID(ctx, *existing.CompanyID)
        for _, pu := range partnerIDs {
            uid := pu.UserID
            _ = u.notifUC.Create(ctx, CreateNotificationInput{
                UserID:        uid,
                Type:          "offer_admin_edited",
                Title:         "Админ изменил ваш оффер: " + existing.Title,
                Body:          comment,
                Link:          "/merchant/offers",
                ReferenceType: "offer",
                ReferenceID:   &offerID,
            })
        }
    }
    return nil
}

// AdminGetOffer — детали оффера для админской модалки
func (u *AdminUsecase) AdminGetOffer(ctx context.Context, id int64) (*domain.Offer, error) {
    return u.offerRepo.GetByID(ctx, id)
}
