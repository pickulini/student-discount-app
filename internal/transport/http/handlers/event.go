package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"
    "time"

    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"

    "github.com/go-chi/chi/v5"
)

type EventHandler struct {
    uc *usecase.EventUsecase
}

func NewEventHandler(uc *usecase.EventUsecase) *EventHandler {
    return &EventHandler{uc: uc}
}

func (h *EventHandler) userID(r *http.Request) (int64, bool) {
    id, ok := r.Context().Value(middleware.UserIDKey).(int64)
    return id, ok
}

func (h *EventHandler) eventID(r *http.Request) (int64, bool) {
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    return id, err == nil && id > 0
}

// POST /api/v1/events
type CreateEventRequest struct {
    Title             string     `json:"title"`
    Description       string     `json:"description"`
    StartAt           string     `json:"start_at"`
    EndAt             string     `json:"end_at"`
    Address           *string    `json:"address,omitempty"`
    ImageURL          *string    `json:"image_url,omitempty"`
    CompanyID         *int64     `json:"company_id,omitempty"`
    EventPrivacy      string     `json:"event_privacy,omitempty"`
    EventUniversityID *int64     `json:"event_university_id,omitempty"`
    MaxUses           *int       `json:"max_uses,omitempty"`
    SpecialPrice      *float64   `json:"special_price,omitempty"`
}

func (h *EventHandler) Create(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.userID(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    var req CreateEventRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    var startAt, endAt time.Time
    if req.StartAt != "" {
        t, err := time.Parse(time.RFC3339, req.StartAt)
        if err != nil {
            writeError(w, http.StatusBadRequest, "invalid start_at")
            return
        }
        startAt = t
    }
    if req.EndAt != "" {
        t, err := time.Parse(time.RFC3339, req.EndAt)
        if err == nil {
            endAt = t
        }
    }

    event, err := h.uc.CreateEvent(r.Context(), usecase.CreateEventInput{
        OrganizerID:       userID,
        CompanyID:         req.CompanyID,
        Title:             req.Title,
        Description:       req.Description,
        StartAt:           startAt,
        EndAt:             endAt,
        Address:           req.Address,
        ImageURL:          req.ImageURL,
        EventPrivacy:      req.EventPrivacy,
        EventUniversityID: req.EventUniversityID,
        MaxUses:           req.MaxUses,
        SpecialPrice:      req.SpecialPrice,
    })
    if err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusCreated, event)
}

// POST /api/v1/events/{id}/submit
func (h *EventHandler) Submit(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.userID(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    id, ok := h.eventID(r)
    if !ok {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    if err := h.uc.SubmitForReview(r.Context(), userID, id); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "submitted"})
}

// GET /api/v1/events
func (h *EventHandler) List(w http.ResponseWriter, r *http.Request) {
    userID, _ := h.userID(r)
    limit := 50
    offset := 0
    if l := r.URL.Query().Get("limit"); l != "" {
        if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 200 {
            limit = v
        }
    }
    if o := r.URL.Query().Get("offset"); o != "" {
        if v, err := strconv.Atoi(o); err == nil && v >= 0 {
            offset = v
        }
    }
    list, err := h.uc.ListEvents(r.Context(), userID, limit, offset)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load events")
        return
    }
    writeJSON(w, http.StatusOK, list)
}

// GET /api/v1/events/{id}
func (h *EventHandler) Get(w http.ResponseWriter, r *http.Request) {
    userID, _ := h.userID(r)
    id, ok := h.eventID(r)
    if !ok {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    event, err := h.uc.GetEvent(r.Context(), id, userID)
    if err != nil {
        writeError(w, http.StatusNotFound, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, event)
}

// POST /api/v1/events/{id}/schedule
func (h *EventHandler) Schedule(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.userID(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    id, ok := h.eventID(r)
    if !ok {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    order, err := h.uc.ScheduleEvent(r.Context(), userID, id)
    if err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusCreated, order)
}

// DELETE /api/v1/events/{id}/schedule
func (h *EventHandler) CancelSchedule(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.userID(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    id, ok := h.eventID(r)
    if !ok {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    if err := h.uc.CancelSchedule(r.Context(), userID, id); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "cancelled"})
}

// GET /api/v1/events/my
func (h *EventHandler) My(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.userID(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    list, err := h.uc.MyEvents(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load events")
        return
    }
    writeJSON(w, http.StatusOK, list)
}

// GET /api/v1/users/by-username/{username}/events (публичный)
func (h *EventHandler) ByUsername(w http.ResponseWriter, r *http.Request) {
    username := chi.URLParam(r, "username")
    if username == "" {
        writeError(w, http.StatusBadRequest, "username required")
        return
    }
    userID, _ := h.userID(r)
    list, err := h.uc.EventsByUsername(r.Context(), username, userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, list)
}


// GET /api/v1/merchant/events?status=...
func (h *EventHandler) MyMerchant(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.userID(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    status := r.URL.Query().Get("status")
    limit := 100
    offset := 0
    if l := r.URL.Query().Get("limit"); l != "" {
        if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 200 {
            limit = v
        }
    }
    if o := r.URL.Query().Get("offset"); o != "" {
        if v, err := strconv.Atoi(o); err == nil && v >= 0 {
            offset = v
        }
    }
    list, err := h.uc.MyEventsByStatus(r.Context(), userID, status, limit, offset)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load events")
        return
    }
    writeJSON(w, http.StatusOK, list)
}

// GET /api/v1/users/by-username/{username}/attending (публичный)
func (h *EventHandler) AttendingByUsername(w http.ResponseWriter, r *http.Request) {
    username := chi.URLParam(r, "username")
    if username == "" {
        writeError(w, http.StatusBadRequest, "username required")
        return
    }
    userID, _ := h.userID(r)
    list, err := h.uc.AttendingByUsername(r.Context(), username, userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, list)
}
