package middleware

import (
    "context"
    "net/http"
    "strings"

    "your-project/internal/infrastructure/crypto"
)

// OptionalAuth — пытается распарсить токен, но не падает при его отсутствии.
// Используется для публичных роутов, где важно знать текущего viewer-а.
func OptionalAuth(jwtManager *crypto.JWTManager) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            tokenString := ""
            authHeader := r.Header.Get("Authorization")
            if authHeader != "" {
                parts := strings.Split(authHeader, " ")
                if len(parts) == 2 && parts[0] == "Bearer" {
                    tokenString = parts[1]
                }
            }
            if tokenString == "" {
                tokenString = r.URL.Query().Get("token")
            }
            if tokenString != "" {
                if claims, err := jwtManager.Verify(tokenString); err == nil {
                    ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
                    r = r.WithContext(ctx)
                }
            }
            next.ServeHTTP(w, r)
        })
    }
}
