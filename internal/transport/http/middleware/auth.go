package middleware

import (
    "context"
    "net/http"
    "strings"
    "sync"
    "time"
    "your-project/internal/infrastructure/crypto"
)

type contextKey string

const UserIDKey contextKey = "user_id"
const SessionIDKey contextKey = "session_id"

// SessionAlive проверяет, что сессия не отозвана (задаётся в main).
// Результат кешируется на 15 секунд, чтобы не ходить в базу на каждый запрос.
var SessionAlive func(ctx context.Context, sessionID, userID int64) bool

type sessCacheEntry struct {
    alive bool
    at    time.Time
}

var (
    sessCacheMu sync.Mutex
    sessCache   = map[int64]sessCacheEntry{}
)

func sessionOK(ctx context.Context, sid, uid int64) bool {
    if sid == 0 || SessionAlive == nil {
        return true
    }
    sessCacheMu.Lock()
    e, ok := sessCache[sid]
    sessCacheMu.Unlock()
    if ok && time.Since(e.at) < 15*time.Second {
        return e.alive
    }
    alive := SessionAlive(ctx, sid, uid)
    sessCacheMu.Lock()
    if len(sessCache) > 10000 {
        sessCache = map[int64]sessCacheEntry{}
    }
    sessCache[sid] = sessCacheEntry{alive: alive, at: time.Now()}
    sessCacheMu.Unlock()
    return alive
}

// ForgetSessions — сбросить кеш после отзыва, чтобы отзыв сработал сразу.
func ForgetSessions() {
    sessCacheMu.Lock()
    sessCache = map[int64]sessCacheEntry{}
    sessCacheMu.Unlock()
}

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
            if !sessionOK(r.Context(), claims.SessionID, claims.UserID) {
                writeError(w, http.StatusUnauthorized, "session revoked")
                return
            }
            ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
            ctx = context.WithValue(ctx, SessionIDKey, claims.SessionID)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}

func writeError(w http.ResponseWriter, status int, message string) {
    http.Error(w, message, status)
}
