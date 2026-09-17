package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
)

type UserHandler struct {
    userUsecase *usecase.UserUsecase
}

func NewUserHandler(uu *usecase.UserUsecase) *UserHandler {
    return &UserHandler{userUsecase: uu}
}

func (h *UserHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    user, cashBalance, bonusBalance, err := h.userUsecase.GetProfile(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load profile")
        return
    }
    response := map[string]interface{}{
        "id":             user.ID,
        "email":          user.Email,
        "full_name":      user.FullName,
        "nickname":       user.Nickname,
        "username":       user.Username,
        "avatar_url":     user.AvatarURL,
        "student_status": user.StudentStatus,
        "referral_code":  user.ReferralCode,
        "balance":        cashBalance,
        "bonus_balance":  bonusBalance,
        "is_active":      user.IsActive,
        "role":           user.Role,
        "created_at":     user.CreatedAt,
        "updated_at":     user.UpdatedAt,
    }
    writeJSON(w, http.StatusOK, response)
}

func (h *UserHandler) GetTransactionHistory(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    limit := 50
    offset := 0
    if l := r.URL.Query().Get("limit"); l != "" {
        if v, err := strconv.Atoi(l); err == nil && v > 0 {
            limit = v
        }
    }
    if o := r.URL.Query().Get("offset"); o != "" {
        if v, err := strconv.Atoi(o); err == nil && v >= 0 {
            offset = v
        }
    }
    transactions, err := h.userUsecase.GetTransactionHistory(r.Context(), userID, limit, offset)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load transaction history")
        return
    }
    writeJSON(w, http.StatusOK, transactions)
}

type UpdateProfileRequest struct {
    Nickname  *string `json:"nickname,omitempty"`
    Username  *string `json:"username,omitempty"`
    AvatarURL *string `json:"avatar_url,omitempty"`
}

func (h *UserHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }

    var req UpdateProfileRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }

    if err := h.userUsecase.UpdateProfile(r.Context(), userID, req.Nickname, req.Username, req.AvatarURL); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }

    user, cashBalance, bonusBalance, err := h.userUsecase.GetProfile(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load profile")
        return
    }

    response := map[string]interface{}{
        "id":             user.ID,
        "email":          user.Email,
        "full_name":      user.FullName,
        "nickname":       user.Nickname,
        "username":       user.Username,
        "avatar_url":     user.AvatarURL,
        "student_status": user.StudentStatus,
        "referral_code":  user.ReferralCode,
        "balance":        cashBalance,
        "bonus_balance":  bonusBalance,
        "is_active":      user.IsActive,
        "role":           user.Role,
        "created_at":     user.CreatedAt,
        "updated_at":     user.UpdatedAt,
    }
    writeJSON(w, http.StatusOK, response)
}
