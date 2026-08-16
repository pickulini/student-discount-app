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
    UserID int64 `json:"sub"`
    jwt.RegisteredClaims
}

func (m *JWTManager) Generate(userID int64) (string, error) {
    claims := Claims{
        UserID: userID,
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
        return m.secret, nil
    })
    if err != nil {
        return nil, err
    }
    if claims, ok := token.Claims.(*Claims); ok && token.Valid {
        return claims, nil
    }
    return nil, errors.New("invalid token")
}
