package middleware

import (
    "strconv"
    "net/http"
    "sync"
    "time"
)

// RateLimit — простой rate-limiter с фиксированным окном (1 минута) на IP.
// Реализован на стандартной библиотеке (без внешних зависимостей), чтобы не тащить
// в go.mod пакет вроде golang.org/x/time/rate только ради одного эндпоинта.
//
// Используется, в первую очередь, чтобы прикрыть /auth/login от подбора пароля
// (credential stuffing / brute force) — раньше на логин не было вообще никакой защиты.
func RateLimit(limitPerMinute int) func(http.Handler) http.Handler {
    if limitPerMinute <= 0 {
        limitPerMinute = 10
    }

    type bucket struct {
        count       int
        windowStart time.Time
    }

    var (
        mu      sync.Mutex
        buckets = make(map[string]*bucket)
    )

    // Периодически чистим давно неактивные записи, чтобы карта не росла бесконечно.
    go func() {
        ticker := time.NewTicker(10 * time.Minute)
        defer ticker.Stop()
        for range ticker.C {
            mu.Lock()
            cutoff := time.Now().Add(-10 * time.Minute)
            for ip, b := range buckets {
                if b.windowStart.Before(cutoff) {
                    delete(buckets, ip)
                }
            }
            mu.Unlock()
        }
    }()

    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ip := GetIP(r.Context())
            if ip == "" {
                ip = r.RemoteAddr
            }

            now := time.Now()
            mu.Lock()
            b, ok := buckets[ip]
            if !ok || now.Sub(b.windowStart) >= time.Minute {
                b = &bucket{count: 0, windowStart: now}
                buckets[ip] = b
            }
            b.count++
            exceeded := b.count > limitPerMinute
            remaining := limitPerMinute - b.count
            mu.Unlock()
            if remaining < 0 {
                remaining = 0
            }
            // Фронтенд показывает «осталось N попыток» после неверного пароля.
            w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))

            if exceeded {
                w.Header().Set("Retry-After", "60")
                writeError(w, http.StatusTooManyRequests, "too many requests, try again later")
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
