package handlers

import (
    "net/http"
    "strconv"
    "your-project/internal/usecase"
)

type AuditHandler struct {
    auditUsecase *usecase.AuditUsecase
}

func NewAuditHandler(au *usecase.AuditUsecase) *AuditHandler {
    return &AuditHandler{auditUsecase: au}
}

func (h *AuditHandler) List(w http.ResponseWriter, r *http.Request) {
    limit := 100
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
    logs, err := h.auditUsecase.List(r.Context(), limit, offset)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load audit logs")
        return
    }
    writeJSON(w, http.StatusOK, logs)
}
