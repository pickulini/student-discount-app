package middleware

import (
    "context"
    "net"
    "net/http"
    "strings"
)

type contextKeyInfo string

const (
    RequestIPKey        contextKeyInfo = "request_ip"
    RequestUserAgentKey contextKeyInfo = "request_user_agent"
)

func RequestInfo(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ip := r.Header.Get("X-Real-IP")
        if ip == "" {
            ip = r.Header.Get("X-Forwarded-For")
        }
        if ip == "" {
            ip = r.RemoteAddr
        }
        // Убираем порт, если он есть (например, "192.168.1.1:26799")
        if host, _, err := net.SplitHostPort(ip); err == nil {
            ip = host
        }
        // Если X-Forwarded-For содержит несколько адресов — берём первый
        if idx := strings.Index(ip, ","); idx != -1 {
            ip = strings.TrimSpace(ip[:idx])
        }
        userAgent := r.Header.Get("User-Agent")
        ctx := context.WithValue(r.Context(), RequestIPKey, ip)
        ctx = context.WithValue(ctx, RequestUserAgentKey, userAgent)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func GetIP(ctx context.Context) string {
    if v, ok := ctx.Value(RequestIPKey).(string); ok {
        return v
    }
    return ""
}

func GetUserAgent(ctx context.Context) string {
    if v, ok := ctx.Value(RequestUserAgentKey).(string); ok {
        return v
    }
    return ""
}
