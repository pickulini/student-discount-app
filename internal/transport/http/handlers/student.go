package handlers

import (
    "net/http"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
)

type StudentHandler struct {
    authUsecase *usecase.AuthUsecase
}

func NewStudentHandler(au *usecase.AuthUsecase) *StudentHandler {
    return &StudentHandler{authUsecase: au}
}

func (h *StudentHandler) RequestVerification(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }

    // Вызываем метод с двумя аргументами
    err := h.authUsecase.RequestVerification(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to request verification")
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"status": "pending"})
}
