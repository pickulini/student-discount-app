package middleware

import (
    "bytes"
    "io"
    "net/http"
    "strings"
    "your-project/internal/usecase"
)

func AuditLog(auditUsecase *usecase.AuditUsecase) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Логируем только изменяющие методы к /admin/
            isAdminMutation := strings.HasPrefix(r.URL.Path, "/api/v1/admin/") &&
                (r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodDelete)

            if !isAdminMutation {
                next.ServeHTTP(w, r)
                return
            }

            // Сохраняем тело запроса
            var bodyCopy []byte
            if r.Body != nil {
                bodyCopy, _ = io.ReadAll(r.Body)
                r.Body = io.NopCloser(bytes.NewBuffer(bodyCopy))
            }

            // Обрабатываем запрос
            next.ServeHTTP(w, r)

            // Логируем после обработки
            actorID := int64(0)
            if v, ok := r.Context().Value(UserIDKey).(int64); ok {
                actorID = v
            }

            metadata := map[string]interface{}{
                "method": r.Method,
                "path":   r.URL.Path,
                "query":  r.URL.RawQuery,
            }
            if len(bodyCopy) > 0 && len(bodyCopy) < 2048 {
                metadata["body"] = string(bodyCopy)
            }

            auditUsecase.Log(r.Context(), actorID,
                strings.ToLower(r.Method)+" "+r.URL.Path,
                "admin_api", 0,
                metadata,
                GetIP(r.Context()),
                GetUserAgent(r.Context()))
        })
    }
}
