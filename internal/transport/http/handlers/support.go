package handlers

import (
    "your-project/internal/journal"
    "strings"
    "encoding/json"
    "net/http"
    "strconv"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
    "github.com/go-chi/chi/v5"
)

type SupportHandler struct {
    supportUsecase *usecase.SupportUsecase
}

func NewSupportHandler(su *usecase.SupportUsecase) *SupportHandler {
    return &SupportHandler{supportUsecase: su}
}

// ---- Пользовательские эндпоинты ----

type CreateTicketRequest struct {
    Subject      string `json:"subject"`
    FirstMessage string `json:"first_message"`
}

func (h *SupportHandler) CreateTicket(w http.ResponseWriter, r *http.Request) {
    var req CreateTicketRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    ticket, err := h.supportUsecase.CreateTicket(r.Context(), userID, req.Subject, req.FirstMessage)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to create ticket")
        return
    }
    writeJSON(w, http.StatusCreated, ticket)
}

func (h *SupportHandler) GetUserTickets(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    tickets, err := h.supportUsecase.GetUserTickets(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load tickets")
        return
    }
    writeJSON(w, http.StatusOK, tickets)
}

func (h *SupportHandler) GetTicketMessages(w http.ResponseWriter, r *http.Request) {
    ticketID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid ticket id")
        return
    }
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    // Чужие обращения читать нельзя.
    if !h.supportUsecase.OwnsTicket(r.Context(), ticketID, userID) {
        writeError(w, http.StatusNotFound, "ticket not found")
        return
    }
    messages, err := h.supportUsecase.GetTicketMessages(r.Context(), ticketID, userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load messages")
        return
    }
    writeJSON(w, http.StatusOK, messages)
}

type AddMessageRequest struct {
    Message string `json:"message"`
}

func (h *SupportHandler) AddMessage(w http.ResponseWriter, r *http.Request) {
    ticketID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid ticket id")
        return
    }
    var req AddMessageRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    // Писать можно только в своё обращение.
    if !h.supportUsecase.OwnsTicket(r.Context(), ticketID, userID) {
        writeError(w, http.StatusNotFound, "ticket not found")
        return
    }
    if strings.TrimSpace(req.Message) == "" {
        writeError(w, http.StatusBadRequest, "empty message")
        return
    }
    msg, err := h.supportUsecase.AddMessage(r.Context(), ticketID, userID, req.Message, false)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to add message")
        return
    }
    writeJSON(w, http.StatusCreated, msg)
}

// ---- Админские эндпоинты ----

func (h *SupportHandler) AdminListTickets(w http.ResponseWriter, r *http.Request) {
    tickets, err := h.supportUsecase.ListAllTickets(r.Context(), 100, 0)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load tickets")
        return
    }
    writeJSON(w, http.StatusOK, tickets)
}

func (h *SupportHandler) AdminUpdateTicketStatus(w http.ResponseWriter, r *http.Request) {
    ticketID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid ticket id")
        return
    }
    var req struct {
        Status string `json:"status"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    labels := map[string]string{"open": "открыт", "in_progress": "в работе", "resolved": "решён", "closed": "закрыт"}
    if labels[req.Status] == "" {
        writeError(w, http.StatusBadRequest, "unknown status")
        return
    }
    if err := h.supportUsecase.UpdateTicketStatus(r.Context(), ticketID, req.Status); err != nil {
        writeError(w, http.StatusInternalServerError, "failed to update status")
        return
    }
    actor, _ := r.Context().Value(middleware.UserIDKey).(int64)
    journal.Log(r.Context(), actor, journal.SupportStatus, "ticket", ticketID, "Обращение: "+labels[req.Status])
    writeJSON(w, http.StatusOK, map[string]string{"message": "status updated"})
}

func (h *SupportHandler) AdminAddMessage(w http.ResponseWriter, r *http.Request) {
    ticketID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid ticket id")
        return
    }
    var req AddMessageRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    // Для админа, userID = admin (но мы можем взять из контекста)
    adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    if strings.TrimSpace(req.Message) == "" {
        writeError(w, http.StatusBadRequest, "пустое сообщение")
        return
    }
    msg, err := h.supportUsecase.AddMessage(r.Context(), ticketID, adminID, req.Message, true) // isInternal = true: ответ поддержки
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to add message")
        return
    }
    // Первый ответ берёт обращение в работу.
    if t, err := h.supportUsecase.GetTicket(r.Context(), ticketID); err == nil && t != nil && t.Status == "open" {
        _ = h.supportUsecase.UpdateTicketStatus(r.Context(), ticketID, "in_progress")
    }
    writeJSON(w, http.StatusCreated, msg)
}
