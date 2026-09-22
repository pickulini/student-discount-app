package middleware

import "net/http"

// CORS ограничивает кросс-доменные запросы одним разрешённым origin (обычно это FRONTEND_URL).
// Раньше здесь стояла "*", что вместе с поддержкой заголовка Authorization слишком
// вольно для продакшена — лучше явно перечислять, кому разрешено ходить в API.
func CORS(allowedOrigin string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            origin := r.Header.Get("Origin")
            if allowedOrigin != "" {
                if origin != "" && origin == allowedOrigin {
                    w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
                    w.Header().Set("Vary", "Origin")
                }
            } else {
                // FRONTEND_URL не задан — чтобы не сломать локальную разработку,
                // отражаем присланный Origin, но это надо задать явно в проде.
                if origin != "" {
                    w.Header().Set("Access-Control-Allow-Origin", origin)
                    w.Header().Set("Vary", "Origin")
                }
            }
            w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
            w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
            if r.Method == "OPTIONS" {
                w.WriteHeader(http.StatusOK)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
