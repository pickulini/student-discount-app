package handlers

import (
    "encoding/json"
    "fmt"
    "net/http"
    "strconv"
    "time"

    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"

    "github.com/go-chi/chi/v5"
)

type NotificationHandler struct {
    uc *usecase.NotificationUsecase
}

func NewNotificationHandler(uc *usecase.NotificationUsecase) *NotificationHandler {
    return &NotificationHandler{uc: uc}
}

func (h *NotificationHandler) userID(r *http.Request) (int64, bool) {
    id, ok := r.Context().Value(middleware.UserIDKey).(int64)
    return id, ok
}

// GET /api/v1/notifications/stream  (SSE)
func (h *NotificationHandler) Stream(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.userID(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    flusher, ok := w.(http.Flusher)
    if !ok {
        writeError(w, http.StatusInternalServerError, "streaming not supported")
        return
    }
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    w.Header().Set("X-Accel-Buffering", "no")

    ch := h.uc.Hub().Subscribe(userID)
    defer h.uc.Hub().Unsubscribe(userID, ch)

    // первое сообщение — handshake
    fmt.Fprintf(w, "event: connected\ndata: {}\n\n")
    flusher.Flush()

    // keep-alive каждые 25 сек
    ticker := time.NewTicker(25 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-r.Context().Done():
            return
        case <-ticker.C:
            fmt.Fprintf(w, ": keep-alive\n\n")
            flusher.Flush()
        case data, ok := <-ch:
            if !ok {
                return
            }
            fmt.Fprintf(w, "event: notification\ndata: %s\n\n", data)
            flusher.Flush()
        }
    }
}

// GET /api/v1/notifications
func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.userID(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    limit := 50
    offset := 0
    if l := r.URL.Query().Get("limit"); l != "" {
        if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100 {
            limit = v
        }
    }
    if o := r.URL.Query().Get("offset"); o != "" {
        if v, err := strconv.Atoi(o); err == nil && v >= 0 {
            offset = v
        }
    }
    list, err := h.uc.List(r.Context(), userID, limit, offset)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, list)
}

// GET /api/v1/notifications/unread/count
func (h *NotificationHandler) CountUnread(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.userID(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    count, err := h.uc.CountUnread(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, map[string]int{"count": count})
}

// POST /api/v1/notifications/{id}/read
func (h *NotificationHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.userID(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    if err := h.uc.MarkRead(r.Context(), id, userID); err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "read"})
}

// POST /api/v1/notifications/read-all
func (h *NotificationHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.userID(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    if err := h.uc.MarkAllRead(r.Context(), userID); err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "ok"})
}

// GET /api/v1/users/me/notification-settings
func (h *NotificationHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.userID(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    user, err := h.uc.GetUserForSettings(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, user)
}

// PATCH /api/v1/users/me/notification-settings
func (h *NotificationHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.userID(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    var req struct {
        Enabled *bool `json:"enabled,omitempty"`
        Friends *bool `json:"friends,omitempty"`
        Events  *bool `json:"events,omitempty"`
        Offers  *bool `json:"offers,omitempty"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    if err := h.uc.UpdateSettings(r.Context(), userID, req.Enabled, req.Friends, req.Events, req.Offers); err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "ok"})
}
