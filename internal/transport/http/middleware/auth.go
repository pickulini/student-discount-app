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
            tokenString := ""
            authHeader := r.Header.Get("Authorization")
            if authHeader != "" {
                parts := strings.Split(authHeader, " ")
                if len(parts) == 2 && parts[0] == "Bearer" {
                    tokenString = parts[1]
                }
            }
            // fallback для SSE (EventSource не умеет кастомные заголовки)
            if tokenString == "" {
                tokenString = r.URL.Query().Get("token")
            }
            if tokenString == "" {
                writeError(w, http.StatusUnauthorized, "missing token")
                return
            }
            claims, err := jwtManager.Verify(tokenString)
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
