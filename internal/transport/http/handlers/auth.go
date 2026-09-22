package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"
    "your-project/internal/domain"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"

    "github.com/go-chi/chi/v5"
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
    ip := middleware.GetIP(r.Context())
    if ip == "" {
        ip = r.RemoteAddr
    }
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

    var req struct {
        UniversityID      *int64 `json:"university_id,omitempty"`
        UniversityName    string `json:"university_name,omitempty"`
        StudentIdentifier string `json:"student_identifier"`
        DocumentKey       string `json:"document_key"`
        SelfieKey         string `json:"selfie_key"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }

    err := h.authUsecase.RequestVerification(r.Context(), userID, usecase.VerificationRequest{
        UniversityID:      req.UniversityID,
        UniversityName:    req.UniversityName,
        StudentIdentifier: req.StudentIdentifier,
        DocumentKey:       req.DocumentKey,
        SelfieKey:         req.SelfieKey,
    })
    if err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"status": "pending"})
}

// PATCH /api/v1/users/me/password
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    var req struct {
        OldPassword string `json:"old_password"`
        NewPassword string `json:"new_password"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    if err := h.authUsecase.ChangePassword(r.Context(), userID, req.OldPassword, req.NewPassword); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "password changed"})
}

// GET /api/v1/users/me/sessions
func (h *AuthHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    sessions, err := h.authUsecase.ListSessions(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, sessions)
}

// DELETE /api/v1/users/me/sessions/{id}
func (h *AuthHandler) RevokeSession(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    if err := h.authUsecase.RevokeSession(r.Context(), userID, id); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "revoked"})
}

// DELETE /api/v1/users/me/sessions
func (h *AuthHandler) RevokeAllSessions(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    if err := h.authUsecase.RevokeAllSessions(r.Context(), userID); err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "all revoked"})
}

// DELETE /api/v1/users/me
func (h *AuthHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    var req struct {
        Password string `json:"password"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    if err := h.authUsecase.DeleteAccount(r.Context(), userID, req.Password); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "account deleted"})
}
