package usecase

import (
    "context"
    "strings"
    "crypto/rand"
    "crypto/sha256"
    "encoding/hex"
    "errors"
    "log"
    "time"
    "your-project/internal/domain"
    "your-project/internal/infrastructure/crypto"
    "your-project/internal/repository"
    "your-project/internal/util"
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

    // Автоопределение вуза по домену email
    if universityID == nil {
        if at := strings.LastIndex(email, "@"); at > 0 {
            emailDomain := strings.ToLower(email[at+1:])
            log.Printf("[AUTH] looking up university by domain: %s", emailDomain)
            uni, err := u.uniRepo.GetByDomain(ctx, emailDomain)
            if err != nil {
                log.Printf("[AUTH] GetByDomain error: %v", err)
            } else if uni != nil {
                log.Printf("[AUTH] matched university id=%d name=%s", uni.ID, uni.Name)
                uid := uni.ID
                universityID = &uid
            } else {
                log.Printf("[AUTH] no university for domain %s", emailDomain)
            }
        }
    }

    username := generateUniqueUsername(ctx, u.userRepo, fullName)
    user := &domain.User{
        Username:       &username,
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

type VerificationRequest struct {
    UniversityID      *int64
    UniversityName    string
    StudentIdentifier string
    DocumentKey       string
    SelfieKey         string
}

func (u *AuthUsecase) RequestVerification(ctx context.Context, userID int64, req VerificationRequest) error {
    existing, err := u.studentVerifRepo.GetByUserID(ctx, userID)
    if err == nil && existing != nil {
        if existing.Status == "pending" {
            return errors.New("заявка уже отправлена и рассматривается")
        }
        if existing.Status == "verified" {
            return errors.New("вы уже верифицированы")
        }
    }

    if req.DocumentKey == "" {
        return errors.New("приложите фото студенческого")
    }
    if req.SelfieKey == "" {
        return errors.New("приложите селфи")
    }

    // Если user ввёл свой вуз (не из списка) — ищем по названию, если нет — создаём
    if req.UniversityID == nil && req.UniversityName != "" {
        uni, err := u.uniRepo.GetByName(ctx, req.UniversityName)
        if err != nil || uni == nil {
            newUni := &domain.University{
                Name:     req.UniversityName,
                IsActive: true,
            }
            if err := u.uniRepo.Create(ctx, newUni); err != nil {
                return errors.New("не удалось создать вуз: " + err.Error())
            }
            uni = newUni
        }
        req.UniversityID = &uni.ID
    }

    verif := &domain.StudentVerification{
        UserID:            userID,
        Method:            "manual",
        Status:            "pending",
        UniversityID:      req.UniversityID,
        StudentIdentifier: req.StudentIdentifier,
        DocumentKey:       req.DocumentKey,
        SelfieKey:         req.SelfieKey,
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


// generateUniqueUsername делает username из full_name и разрешает коллизии
// суффиксом _2, _3, ...
func generateUniqueUsername(ctx context.Context, userRepo repository.UserRepository, fullName string) string {
    base := util.SlugifyUsername(fullName)
    if base == "" {
        base = "user"
    }
    candidate := base

    for i := 2; i < 100; i++ {
        exists, err := userRepo.UsernameExists(ctx, candidate)
        if err != nil {
            break
        }
        if !exists {
            return candidate
        }
        suffix := "_" + itoa(i)
        trimmed := base
        if len(trimmed)+len(suffix) > 30 {
            trimmed = trimmed[:30-len(suffix)]
        }
        candidate = trimmed + suffix
    }
    // fallback — timestamp-based
    return base + "_" + itoa(int(time.Now().Unix()%100000))
}

func itoa(n int) string {
    if n == 0 {
        return "0"
    }
    var digits []byte
    for n > 0 {
        digits = append([]byte{byte('0' + n%10)}, digits...)
        n /= 10
    }
    return string(digits)
}

// ChangePassword — смена пароля с проверкой старого.
func (u *AuthUsecase) ChangePassword(ctx context.Context, userID int64, oldPassword, newPassword string) error {
    if len(newPassword) < 8 {
        return errors.New("пароль должен быть не менее 8 символов")
    }
    user, err := u.userRepo.GetByID(ctx, userID)
    if err != nil || user == nil {
        return errors.New("пользователь не найден")
    }
    ok, err := u.hasher.Verify(oldPassword, user.PasswordHash)
    if err != nil || !ok {
        return errors.New("неверный текущий пароль")
    }
    newHash, err := u.hasher.Hash(newPassword)
    if err != nil {
        return err
    }
    if err := u.userRepo.UpdatePassword(ctx, userID, newHash); err != nil {
        return err
    }
    // Отзываем все сессии, кроме текущей — пользователь перелогинится
    _ = u.sessionRepo.RevokeAll(ctx, userID)
    return nil
}

// ListSessions — активные сессии пользователя.
func (u *AuthUsecase) ListSessions(ctx context.Context, userID int64) ([]domain.UserSession, error) {
    return u.sessionRepo.ListByUserID(ctx, userID)
}

// RevokeSession — отозвать сессию пользователя.
func (u *AuthUsecase) RevokeSession(ctx context.Context, userID, sessionID int64) error {
    session, err := u.sessionRepo.GetByID(ctx, sessionID)
    if err != nil || session == nil {
        return errors.New("сессия не найдена")
    }
    if session.UserID != userID {
        return errors.New("это не ваша сессия")
    }
    return u.sessionRepo.Revoke(ctx, sessionID)
}

// RevokeAllSessions — отозвать все сессии.
func (u *AuthUsecase) RevokeAllSessions(ctx context.Context, userID int64) error {
    return u.sessionRepo.RevokeAll(ctx, userID)
}

// DeleteAccount — удаление аккаунта с проверкой пароля.
func (u *AuthUsecase) DeleteAccount(ctx context.Context, userID int64, password string) error {
    user, err := u.userRepo.GetByID(ctx, userID)
    if err != nil || user == nil {
        return errors.New("пользователь не найден")
    }
    ok, err := u.hasher.Verify(password, user.PasswordHash)
    if err != nil || !ok {
        return errors.New("неверный пароль")
    }
    // Отзываем все сессии перед удалением
    _ = u.sessionRepo.RevokeAll(ctx, userID)
    return u.userRepo.DeleteUser(ctx, userID)
}
