package handlers

import (
    "net/http"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
)

type ReferralHandler struct {
    referralUsecase *usecase.ReferralUsecase
}

func NewReferralHandler(ru *usecase.ReferralUsecase) *ReferralHandler {
    return &ReferralHandler{referralUsecase: ru}
}

func (h *ReferralHandler) GetCode(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    code, err := h.referralUsecase.GetReferralCode(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to get referral code")
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"code": code})
}

func (h *ReferralHandler) GetStats(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    stats, err := h.referralUsecase.GetStats(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to get stats")
        return
    }
    writeJSON(w, http.StatusOK, stats)
}
