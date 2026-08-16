package middleware

import (
    "net/http"
    "your-project/internal/repository"
)

func AdminOnly(userRepo repository.UserRepository) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Получаем user_id из контекста (устанавливается в Auth)
            userID, ok := r.Context().Value(UserIDKey).(int64)
            if !ok {
                http.Error(w, "unauthorized", http.StatusUnauthorized)
                return
            }

            // Получаем пользователя из БД
            user, err := userRepo.GetByID(r.Context(), userID)
            if err != nil || user == nil {
                http.Error(w, "user not found", http.StatusUnauthorized)
                return
            }

            // Проверяем роль (пока просто по email, позже добавим поле role)
            // Для демо: если email содержит "admin" - пропускаем
            if user.Email != "admin@example.com" {
                http.Error(w, "forbidden", http.StatusForbidden)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
