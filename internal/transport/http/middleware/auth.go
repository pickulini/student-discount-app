package middleware

import (
    "context"
    "net/http"
    "strings"
    "your-project/internal/infrastructure/crypto"
)

type contextKey string

const UserIDKey contextKey = "user_id"

func Auth(jwtManager *crypto.JWTManager) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            authHeader := r.Header.Get("Authorization")
            if authHeader == "" {
                writeError(w, http.StatusUnauthorized, "missing token")
                return
            }
            parts := strings.Split(authHeader, " ")
            if len(parts) != 2 || parts[0] != "Bearer" {
                writeError(w, http.StatusUnauthorized, "invalid token format")
                return
            }
            claims, err := jwtManager.Verify(parts[1])
            if err != nil {
                writeError(w, http.StatusUnauthorized, "invalid or expired token")
                return
            }
            ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}

func writeError(w http.ResponseWriter, status int, message string) {
    http.Error(w, message, status)
}
