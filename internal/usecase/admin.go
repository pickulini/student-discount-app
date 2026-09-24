package usecase

import (
    "fmt"
    "your-project/internal/journal"
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
    query := `SELECT u.id, u.email, u.full_name, u.student_status, u.referral_code, u.is_active,
                     u.university_id,
                     COALESCE(un.name, '') AS university_name,
                     u.created_at, u.updated_at,
                     COALESCE(a.balance, 0) as account_balance
              FROM users u
              LEFT JOIN accounts a ON u.id = a.user_id AND a.type = 'cash'
              LEFT JOIN universities un ON un.id = u.university_id
              ORDER BY u.id LIMIT $1 OFFSET $2`
    rows, err := u.db.Query(ctx, query, limit, offset)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    users := make([]domain.User, 0)
    for rows.Next() {
        var u domain.User
        var accountBalance float64
        var universityName string
        if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.StudentStatus,
            &u.ReferralCode, &u.IsActive,
            &u.UniversityID,
            &universityName,
            &u.CreatedAt, &u.UpdatedAt, &accountBalance); err != nil {
            return nil, err
        }
        u.Balance = accountBalance
        // UniversityName как дополнительное поле (добавим в domain)
        u.UniversityName = &universityName
        if universityName == "" {
            u.UniversityName = nil
        }
        users = append(users, u)
    }
    return users, nil
}

func (u *AdminUsecase) GetUser(ctx context.Context, id int64) (*domain.User, error) {
    return u.userRepo.GetByID(ctx, id)
}

var allowedUserRoles = map[string]bool{
    "student":  true,
    "merchant": true,
    "admin":    true,
}

var roleNames = map[string]string{"student": "студент", "merchant": "партнёр", "admin": "админ"}

func (u *AdminUsecase) UpdateUserRole(ctx context.Context, userID int64, role string) error {
    return u.UpdateUserRoleBy(ctx, 0, userID, role)
}

// UpdateUserRoleBy — смена роли с записью в журнал от имени админа.
func (u *AdminUsecase) UpdateUserRoleBy(ctx context.Context, actorID, userID int64, role string) error {
    if !allowedUserRoles[role] {
        return errors.New("invalid role")
    }
    old := ""
    if cur, err := u.userRepo.GetByID(ctx, userID); err == nil && cur != nil {
        old = cur.Role
    }
    if err := u.userRepo.UpdateRole(ctx, userID, role); err != nil {
        return err
    }
    if old != role {
        journal.Log(ctx, actorID, journal.UserRole, "user", userID, "Роль: "+roleNames[old]+" → "+roleNames[role])
    }
    return nil
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
func (u *AdminUsecase) ModerateOffer(ctx context.Context, id int64, action string, reason string, actorID int64) error {
    title := ""
    if o, err := u.offerRepo.GetByID(ctx, id); err == nil && o != nil {
        title = o.Title
    }
    if action == "publish" {
        defer journal.Log(ctx, actorID, journal.OfferPublish, "offer", id, "{Опубликовал|Опубликовала} «"+title+"»")
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
        if err := u.offerRepo.UpdateStatusWithReason(ctx, id, "rejected", reason); err != nil {
            return err
        }
        journal.Log(ctx, actorID, journal.OfferReject, "offer", id, "{Отклонил|Отклонила}: «"+reason+"»")
        return nil
    }
    return nil
}
func (u *AdminUsecase) ArchiveOffer(ctx context.Context, id int64, actorID int64) error {
    if err := u.offerRepo.UpdateStatus(ctx, id, "archived"); err != nil {
        return err
    }
    journal.Log(ctx, actorID, journal.OfferArchive, "offer", id, "{Убрал|Убрала} в архив")
    return nil
}

// ---- Верификации ----
func (u *AdminUsecase) ListVerifications(ctx context.Context, limit, offset int) ([]domain.StudentVerification, error) {
    return u.verificationRepo.List(ctx, limit, offset)
}

func (u *AdminUsecase) UpdateVerification(ctx context.Context, id int64, status string, rejectionReason string, adminID int64, expiresOverride ...time.Time) error {
    // 1. Обновляем статус верификации
    if err := u.verificationRepo.UpdateStatus(ctx, id, status, adminID, rejectionReason); err != nil {
        return err
    }

    // Если статус verified — устанавливаем expires_at (30 сентября следующего года)
    if status == "verified" {
        expiresAt := calculateVerificationExpiry(time.Now())
        if len(expiresOverride) > 0 && expiresOverride[0].After(time.Now()) {
            expiresAt = expiresOverride[0]
        }
        if err := u.verificationRepo.SetExpiresAt(ctx, id, expiresAt); err != nil {
            log.Printf("Failed to set expires_at: %v", err)
        }
    }
    if v, err := u.verificationRepo.GetByID(ctx, id); err == nil && v != nil {
        switch status {
        case "verified":
            until := calculateVerificationExpiry(time.Now())
            if v.ExpiresAt != nil {
                until = *v.ExpiresAt
            }
            journal.Log(ctx, adminID, journal.VerifyOK, "user", v.UserID, "{Подтвердил|Подтвердила} верификацию до "+until.Format("02.01.06"))
        case "rejected":
            txt := "{Отклонил|Отклонила} верификацию"
            if rejectionReason != "" {
                txt += ": «" + rejectionReason + "»"
            }
            journal.Log(ctx, adminID, journal.VerifyReject, "user", v.UserID, txt)
        }
    }

    // Уведомление студенту о результате проверки.
    if u.notifUC != nil && (status == "verified" || status == "rejected") {
        if v, err := u.verificationRepo.GetByID(ctx, id); err == nil && v != nil {
            vid := id
            in := CreateNotificationInput{
                UserID:        v.UserID,
                Type:          domain.NotifVerificationDone,
                Link:          "/verification",
                ReferenceType: "verification",
                ReferenceID:   &vid,
            }
            if status == "verified" {
                in.Title = "Статус студента подтверждён"
                until := calculateVerificationExpiry(time.Now())
                if v.ExpiresAt != nil {
                    until = *v.ExpiresAt
                }
                in.Body = "Действует до " + until.Format("02.01.06") + ". Все скидки открыты."
            } else {
                in.Type = "verification_rejected"
                in.Title = "Заявка на верификацию отклонена"
                in.Body = rejectionReason
            }
            _ = u.notifUC.Create(ctx, in)
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

            // Создаём ОТЛОЖЕННУЮ награду пригласившему (pending).
            // По макету «Рефералы»: бонусы приходят обоим в течение суток
            // после верификации — воркер начислит пригласившему через 24 часа.
            const bonusAmount = 100.0
            const creditDelay = 24 * time.Hour

            availableAt := time.Now().Add(creditDelay)
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

            log.Printf("Referrer %d will receive %.2f bonus for user %d after %s",
                referrerID, bonusAmount, user.ID, availableAt.Format(time.RFC3339))

            // Приглашённому — 100 бонусов сразу после одобрения верификации.
            if acc, err := u.bonusRepo.GetByUserID(ctx, user.ID); err == nil && acc != nil {
                welcome := &domain.BonusTransaction{
                    UserID:        user.ID,
                    Amount:        bonusAmount,
                    Type:          "referral_welcome",
                    ReferenceType: "referral",
                    ReferenceID:   referrerID,
                }
                if err := u.bonusRepo.CreateTransaction(ctx, welcome); err != nil {
                    log.Printf("Failed to create welcome bonus: %v", err)
                } else if err := u.bonusRepo.UpdateBalance(ctx, acc.ID, acc.Balance+bonusAmount); err != nil {
                    log.Printf("Failed to credit welcome bonus: %v", err)
                } else if u.notifUC != nil {
                    journal.Log(ctx, 0, journal.BonusRef, "user", user.ID, "Начислено 100 Б за регистрацию по приглашению")
                    _ = u.notifUC.Create(ctx, CreateNotificationInput{
                        UserID: user.ID,
                        Type:   "bonus_credited",
                        Title:  "Начислено 100 бонусов за регистрацию по приглашению",
                        Link:   "/wallet",
                    })
                }
            }
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
func (u *AdminUsecase) AdminEditOffer(ctx context.Context, offerID int64, updated *domain.Offer, comment string, editorID int64) error {
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
        "base_price":        updated.BasePrice,
        "start_at":          updated.StartAt.Format(time.RFC3339),
        "end_at":            updated.EndAt.Format(time.RFC3339),
        "bonus_allowed":     updated.BonusAllowed,
        "max_bonus_percent": updated.MaxBonusPercent,
        "address":           updated.Address,
        "phone":             updated.Phone,
        "website":           updated.Website,
        "working_hours":     updated.WorkingHours,
        "image_url":         updated.ImageURL,
        "latitude":          updated.Latitude,
        "longitude":         updated.Longitude,
        "place_name":        updated.PlaceName,
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

    if err := u.offerRepo.SetAdminEdits(ctx, offerID, dataJSON, comment, editorID); err != nil {
        return err
    }
    journal.Log(ctx, editorID, journal.OfferEdit, "offer", offerID,
        fmt.Sprintf("{Отправил|Отправила} правки партнёру (%s)", pluralFields(countOfferChanges(existing, updated))))

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

func (u *AdminUsecase) SetUserUniversity(ctx context.Context, userID int64, universityID *int64) error {
    return u.userRepo.SetUniversity(ctx, userID, universityID)
}

// countOfferChanges — сколько полей админ поменял (для журнала «правки партнёру (4 поля)»).
func countOfferChanges(a, b *domain.Offer) int {
    n := 0
    diff := func(x, y interface{}) {
        if fmt.Sprint(x) != fmt.Sprint(y) {
            n++
        }
    }
    diff(a.Title, b.Title)
    diff(a.Description, b.Description)
    diff(a.DiscountType, b.DiscountType)
    diff(a.DiscountValue, b.DiscountValue)
    diff(a.BasePrice, b.BasePrice)
    diff(a.StartAt.In(moscow).Format("2006-01-02"), b.StartAt.In(moscow).Format("2006-01-02"))
    diff(a.EndAt.In(moscow).Format("2006-01-02"), b.EndAt.In(moscow).Format("2006-01-02"))
    diff(a.BonusAllowed, b.BonusAllowed)
    diff(a.MaxBonusPercent, b.MaxBonusPercent)
    diff(deref(a.Address), deref(b.Address))
    diff(deref(a.Phone), deref(b.Phone))
    diff(deref(a.Website), deref(b.Website))
    diff(deref(a.WorkingHours), deref(b.WorkingHours))
    diff(deref(a.ImageURL), deref(b.ImageURL))
    return n
}

func deref(p *string) string {
    if p == nil {
        return ""
    }
    return *p
}

func pluralFields(n int) string {
    switch {
    case n%10 == 1 && n%100 != 11:
        return fmt.Sprintf("%d поле", n)
    case n%10 >= 2 && n%10 <= 4 && (n%100 < 10 || n%100 >= 20):
        return fmt.Sprintf("%d поля", n)
    default:
        return fmt.Sprintf("%d полей", n)
    }
}
