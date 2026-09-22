package middleware

import "net/http"

// SecurityHeaders добавляет базовые защитные заголовки. Ничего специфичного под фреймворк —
// просто хорошая гигиена, которой не было вообще.
func SecurityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
        next.ServeHTTP(w, r)
    })
}
