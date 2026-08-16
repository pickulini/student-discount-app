package middleware

import (
    "net/http"
    "your-project/internal/repository"
)

func MerchantOnly(userRepo repository.UserRepository) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            userID, ok := r.Context().Value(UserIDKey).(int64)
            if !ok {
                http.Error(w, "unauthorized", http.StatusUnauthorized)
                return
            }
            user, err := userRepo.GetByID(r.Context(), userID)
            if err != nil || user == nil {
                http.Error(w, "user not found", http.StatusUnauthorized)
                return
            }
            if user.Role != "merchant" {
                http.Error(w, "forbidden: merchant role required", http.StatusForbidden)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
