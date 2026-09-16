package usecase

import (
    "context"
    "crypto/rand"
    "crypto/sha256"
    "encoding/hex"
    "errors"
    "log"
    "time"
    "your-project/internal/domain"
    "your-project/internal/infrastructure/crypto"
    "your-project/internal/repository"
)

type AuthUsecase struct {
    userRepo         repository.UserRepository
    sessionRepo      repository.SessionRepository
    studentVerifRepo repository.StudentVerificationRepository
    uniRepo          repository.UniversityRepository
    accountRepo      repository.AccountRepository
    bonusRepo        repository.BonusRepository
    referralRepo     repository.ReferralRepository
    antifraudRepo    repository.AntifraudRepository
    hasher           *crypto.PasswordHasher
    jwtManager       *crypto.JWTManager
    frontendURL      string
}

func NewAuthUsecase(
    userRepo repository.UserRepository,
    sessionRepo repository.SessionRepository,
    studentVerifRepo repository.StudentVerificationRepository,
    uniRepo repository.UniversityRepository,
    accountRepo repository.AccountRepository,
    bonusRepo repository.BonusRepository,
    referralRepo repository.ReferralRepository,
    antifraudRepo repository.AntifraudRepository,
    hasher *crypto.PasswordHasher,
    jwtManager *crypto.JWTManager,
    frontendURL string,
) *AuthUsecase {
    return &AuthUsecase{
        userRepo:         userRepo,
        sessionRepo:      sessionRepo,
        studentVerifRepo: studentVerifRepo,
        uniRepo:          uniRepo,
        accountRepo:      accountRepo,
        bonusRepo:        bonusRepo,
        referralRepo:     referralRepo,
        antifraudRepo:    antifraudRepo,
        hasher:           hasher,
        jwtManager:       jwtManager,
        frontendURL:      frontendURL,
    }
}

// Register — с проверками антифрода
func (u *AuthUsecase) Register(ctx context.Context, email, password, fullName string, universityID *int64, course *int, referralCode, clientIP string) (*domain.User, string, error) {
    // TODO: в продакшене заменить на device fingerprint + 2FA (email/SMS)
    // === ANTIFRAUD: Rate limit по IP (100 регистраций в час) ===
    ipHash := hashString(clientIP)
    count, err := u.antifraudRepo.CountRegistrationsByIPHash(ctx, ipHash, 60)
    if err == nil && count >= 100 {
        return nil, "", errors.New("too many registrations from your IP, try again later")
    }

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

        // === ANTIFRAUD: нельзя пригласить самого себя ===
        // Проверяем по email (поскольку новый пользователь ещё не создан)
        if referrer != nil && referrer.Email == email {
            return nil, "", errors.New("cannot refer yourself")
        }
    }

    var referredBy *int64
    if referrer != nil {
        referredBy = &referrer.ID
    }

    user := &domain.User{
        Email:         email,
        PasswordHash:  hash,
        FullName:      fullName,
        UniversityID:  universityID,
        Course:        course,
        StudentStatus: "pending",
        ReferralCode:  code,
        ReferredBy:    referredBy,
        IsActive:      true,
        Balance:       0,
        Role:          "student",
    }
    if err := u.userRepo.Create(ctx, user); err != nil {
        return nil, "", err
    }

    // Логируем попытку регистрации для антифрода
    if err := u.antifraudRepo.LogRegistrationAttempt(ctx, ipHash, email); err != nil {
        log.Printf("failed to log registration attempt: %v", err)
    }

    account := &domain.Account{
        UserID:   user.ID,
        Type:     "cash",
        Currency: "RUB",
        Balance:  0,
        Status:   "active",
    }
    if err := u.accountRepo.Create(ctx, account); err != nil {
        log.Printf("failed to create account for user %d: %v", user.ID, err)
        return nil, "", err
    }

    bonusAcc := &domain.BonusAccount{
        UserID:  user.ID,
        Balance: 0,
    }
    if err := u.bonusRepo.CreateAccount(ctx, bonusAcc); err != nil {
        log.Printf("failed to create bonus account for user %d: %v", user.ID, err)
        return nil, "", err
    }

    // Создаём referral_invite
    if referrer != nil {
        invite := &domain.ReferralInvite{
            ReferrerID:     referrer.ID,
            ReferredUserID: user.ID,
            Status:         "pending",
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
    user, err := u.userRepo.GetByEmail(ctx, email)
    if err != nil || user == nil {
        return "", "", domain.ErrInvalidCredentials
    }
    if !user.IsActive {
        return "", "", domain.ErrInvalidCredentials
    }
    ok, err := u.hasher.Verify(password, user.PasswordHash)
    if err != nil || !ok {
        return "", "", domain.ErrInvalidCredentials
    }

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
        return "", "", err
    }

    accessToken, err = u.jwtManager.Generate(user.ID)
    if err != nil {
        return "", "", err
    }
    return accessToken, refreshToken, nil
}

func (u *AuthUsecase) RequestVerification(ctx context.Context, userID int64) error {
    existing, err := u.studentVerifRepo.GetByUserID(ctx, userID)
    if err == nil && existing != nil {
        if existing.Status == "pending" || existing.Status == "verified" {
            return nil
        }
    }
    verif := &domain.StudentVerification{
        UserID: userID,
        Method: "manual",
        Status: "pending",
    }
    return u.studentVerifRepo.Create(ctx, verif)
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

func hashString(s string) string {
    h := sha256.Sum256([]byte(s))
    return hex.EncodeToString(h[:])
}
