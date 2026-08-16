package usecase

import (
    "context"
    "crypto/rand"
    "crypto/sha256"
    "encoding/hex"
    "log"
    "time"
    "your-project/internal/domain"
    "your-project/internal/infrastructure/crypto"
    "your-project/internal/repository"
)

type AuthUsecase struct {
    userRepo       repository.UserRepository
    sessionRepo    repository.SessionRepository
    studentVerifRepo repository.StudentVerificationRepository
    uniRepo        repository.UniversityRepository
    accountRepo    repository.AccountRepository
    bonusRepo      repository.BonusRepository
    referralRepo   repository.ReferralRepository
    hasher         *crypto.PasswordHasher
    jwtManager     *crypto.JWTManager
    frontendURL    string
}

func NewAuthUsecase(
    userRepo repository.UserRepository,
    sessionRepo repository.SessionRepository,
    studentVerifRepo repository.StudentVerificationRepository,
    uniRepo repository.UniversityRepository,
    accountRepo repository.AccountRepository,
    bonusRepo repository.BonusRepository,
    referralRepo repository.ReferralRepository,
    hasher *crypto.PasswordHasher,
    jwtManager *crypto.JWTManager,
    frontendURL string,
) *AuthUsecase {
    return &AuthUsecase{
        userRepo:       userRepo,
        sessionRepo:    sessionRepo,
        studentVerifRepo: studentVerifRepo,
        uniRepo:        uniRepo,
        accountRepo:    accountRepo,
        bonusRepo:      bonusRepo,
        referralRepo:   referralRepo,
        hasher:         hasher,
        jwtManager:     jwtManager,
        frontendURL:    frontendURL,
    }
}

func (u *AuthUsecase) Register(ctx context.Context, email, password, fullName string, universityID *int64, course *int, referralCode string) (*domain.User, string, error) {
    existing, _ := u.userRepo.GetByEmail(ctx, email)
    if existing != nil {
        return nil, "", domain.ErrEmailAlreadyExists
    }

    hash, err := u.hasher.Hash(password)
    if err != nil {
        return nil, "", err
    }

    code := generateReferralCode()
    for {
        u2, _ := u.userRepo.GetByReferralCode(ctx, code)
        if u2 == nil {
            break
        }
        code = generateReferralCode()
    }

    var referrer *domain.User
    if referralCode != "" {
        referrer, _ = u.userRepo.GetByReferralCode(ctx, referralCode)
    }

    var referredBy *int64
    if referrer != nil {
        referredBy = &referrer.ID
    }

    user := &domain.User{
        Email:          email,
        PasswordHash:   hash,
        FullName:       fullName,
        UniversityID:   universityID,
        Course:         course,
        StudentStatus:  "pending",
        ReferralCode:   code,
        ReferredBy:     referredBy,
        IsActive:       true,
        Balance:        0,
        Role:           "student",
    }
    if err := u.userRepo.Create(ctx, user); err != nil {
        return nil, "", err
    }

    // Создаём денежный счёт
    account := &domain.Account{
        UserID:   user.ID,
        Type:     "cash",
        Currency: "RUB",
        Balance:  0,
        Status:   "active",
    }
    if err := u.accountRepo.Create(ctx, account); err != nil {
        return nil, "", err
    }

    // Создаём бонусный счёт
    bonusAcc := &domain.BonusAccount{
        UserID:  user.ID,
        Balance: 0,
    }
    if err := u.bonusRepo.CreateAccount(ctx, bonusAcc); err != nil {
        return nil, "", err
    }

    // Если есть реферер – начисляем бонус и создаём записи
    if referrer != nil {
        referrerBonusAcc, err := u.bonusRepo.GetByUserID(ctx, referrer.ID)
        if err != nil {
            log.Printf("failed to get bonus account for referrer %d: %v", referrer.ID, err)
        } else {
            bonusAmount := 100.0
            bonusTx := &domain.BonusTransaction{
                UserID:        referrer.ID,
                Amount:        bonusAmount,
                Type:          "referral_reward",
                ReferenceType: "user",
                ReferenceID:   user.ID,
            }
            if err := u.bonusRepo.CreateTransaction(ctx, bonusTx); err != nil {
                log.Printf("failed to create bonus transaction for referrer %d: %v", referrer.ID, err)
            } else {
                newBalance := referrerBonusAcc.Balance + bonusAmount
                if err := u.bonusRepo.UpdateBalance(ctx, referrerBonusAcc.ID, newBalance); err != nil {
                    log.Printf("failed to update bonus balance for referrer %d: %v", referrer.ID, err)
                } else {
                    log.Printf("referrer %d received %f bonus points for inviting user %d", referrer.ID, bonusAmount, user.ID)
                    reward := &domain.ReferralReward{
                        ReferrerID:     referrer.ID,
                        ReferredUserID: user.ID,
                        Amount:         bonusAmount,
                        Status:         "credited",
                        TriggerType:    "registration",
                    }
                    if err := u.referralRepo.CreateReward(ctx, reward); err != nil {
                        log.Printf("failed to create referral reward for referrer %d: %v", referrer.ID, err)
                    }
                }
            }
        }

        invite := &domain.ReferralInvite{
            ReferrerID:     referrer.ID,
            ReferredUserID: user.ID,
            Status:         "accepted",
        }
        if err := u.referralRepo.CreateInvite(ctx, invite); err != nil {
            log.Printf("failed to create referral invite: %v", err)
        }
    }

    token, err := u.jwtManager.Generate(user.ID)
    if err != nil {
        return nil, "", err
    }
    return user, token, nil
}

func (u *AuthUsecase) Login(ctx context.Context, email, password, deviceName, userAgent, ip string) (accessToken, refreshToken string, err error) {
    log.Printf("Login attempt for email: %s", email)
    user, err := u.userRepo.GetByEmail(ctx, email)
    if err != nil || user == nil {
        log.Printf("user not found")
        return "", "", domain.ErrInvalidCredentials
    }
    if !user.IsActive {
        log.Printf("user not active")
        return "", "", domain.ErrInvalidCredentials
    }
    log.Printf("user found: %+v", user)
    log.Printf("checking password")
    ok, err := u.hasher.Verify(password, user.PasswordHash)
    if err != nil {
        log.Printf("Verify error: %v", err)
        return "", "", err
    }
    if !ok {
        log.Printf("password mismatch")
        return "", "", domain.ErrInvalidCredentials
    }
    log.Printf("password ok")

    refreshToken = generateRandomToken(40)
    hash := sha256.Sum256([]byte(refreshToken))
    refreshHash := hex.EncodeToString(hash[:])

    session := &domain.UserSession{
        UserID:           user.ID,
        RefreshTokenHash: refreshHash,
        DeviceName:       deviceName,
        UserAgent:        userAgent,
        IP:               ip,
        ExpiresAt:        time.Now().Add(7 * 24 * time.Hour),
    }
    if err := u.sessionRepo.Create(ctx, session); err != nil {
        log.Printf("failed to create session: %v", err)
        return "", "", err
    }

    accessToken, err = u.jwtManager.Generate(user.ID)
    if err != nil {
        return "", "", err
    }
    return accessToken, refreshToken, nil
}

func generateReferralCode() string {
    b := make([]byte, 4)
    rand.Read(b)
    return hex.EncodeToString(b)
}

func generateRandomToken(length int) string {
    b := make([]byte, length)
    rand.Read(b)
    return hex.EncodeToString(b)
}

// RequestVerification создаёт заявку на верификацию студента
func (u *AuthUsecase) RequestVerification(ctx context.Context, userID int64) error {
    log.Printf("RequestVerification called for user %d", userID)
    // Проверяем, есть ли уже pending заявка
    existing, err := u.studentVerifRepo.GetByUserID(ctx, userID)
    if err == nil && existing != nil && existing.Status == "pending" {
        log.Printf("pending verification already exists for user %d", userID)
        return nil
    }
    verif := &domain.StudentVerification{
        UserID: userID,
        Method: "manual",
        Status: "pending",
    }
    err = u.studentVerifRepo.Create(ctx, verif)
    if err != nil {
        log.Printf("RequestVerification: Create error: %v", err)
        return err
    }
    log.Printf("RequestVerification: created verification with id %d for user %d", verif.ID, userID)
    return nil
}
