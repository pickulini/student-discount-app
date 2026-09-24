package crypto

import (
    "errors"
    "time"
    "github.com/golang-jwt/jwt/v5"
)

type JWTManager struct {
    secret []byte
    expiry time.Duration
}

func NewJWTManager(secret string, expiryMinutes int) *JWTManager {
    return &JWTManager{
        secret: []byte(secret),
        expiry: time.Duration(expiryMinutes) * time.Minute,
    }
}

type Claims struct {
    UserID    int64 `json:"sub"`
    SessionID int64 `json:"sid,omitempty"` // строка user_sessions; 0 — старый токен без сессии
    jwt.RegisteredClaims
}

func (m *JWTManager) Generate(userID int64) (string, error) {
    return m.GenerateForSession(userID, 0)
}

// GenerateForSession — токен, привязанный к сессии: отзыв сессии гасит и токен.
func (m *JWTManager) GenerateForSession(userID, sessionID int64) (string, error) {
    claims := Claims{
        UserID:    userID,
        SessionID: sessionID,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(m.expiry)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
        },
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(m.secret)
}

func (m *JWTManager) Verify(tokenStr string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
        // Явно проверяем алгоритм подписи: без этого keyFunc отдаёт секрет вне
        // зависимости от того, что указано в заголовке токена (alg confusion).
        if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, errors.New("unexpected signing method")
        }
        return m.secret, nil
    }, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
    if err != nil {
        return nil, err
    }
    if claims, ok := token.Claims.(*Claims); ok && token.Valid {
        return claims, nil
    }
    return nil, errors.New("invalid token")
}
