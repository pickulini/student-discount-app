package handlers

import (
    "encoding/json"
    "net/http"
    "your-project/internal/domain"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
)

type AuthHandler struct {
    authUsecase *usecase.AuthUsecase
}

func NewAuthHandler(au *usecase.AuthUsecase) *AuthHandler {
    return &AuthHandler{authUsecase: au}
}

type RegisterRequest struct {
    Email        string `json:"email"`
    Password     string `json:"password"`
    FullName     string `json:"full_name"`
    UniversityID *int64 `json:"university_id,omitempty"`
    Course       *int   `json:"course,omitempty"`
    ReferralCode string `json:"referral_code,omitempty"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
    var req RegisterRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }

    // Получаем IP из middleware
    clientIP := middleware.GetIP(r.Context())
    if clientIP == "" {
        clientIP = r.RemoteAddr
    }

    user, token, err := h.authUsecase.Register(r.Context(), req.Email, req.Password, req.FullName,
        req.UniversityID, req.Course, req.ReferralCode, clientIP)
    if err != nil {
        switch err {
        case domain.ErrEmailAlreadyExists:
            writeError(w, http.StatusConflict, err.Error())
        default:
            writeError(w, http.StatusBadRequest, err.Error())
        }
        return
    }
    writeJSON(w, http.StatusCreated, map[string]interface{}{
        "user":  user,
        "token": token,
    })
}

type LoginRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
    var req LoginRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    userAgent := r.Header.Get("User-Agent")
    ip := r.RemoteAddr
    accessToken, refreshToken, err := h.authUsecase.Login(r.Context(), req.Email, req.Password, "unknown", userAgent, ip)
    if err != nil {
        writeError(w, http.StatusUnauthorized, "invalid credentials")
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{
        "access_token":  accessToken,
        "refresh_token": refreshToken,
    })
}

func (h *AuthHandler) RequestVerification(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    if err := h.authUsecase.RequestVerification(r.Context(), userID); err != nil {
        writeError(w, http.StatusInternalServerError, "failed to request verification")
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"status": "pending"})
}
