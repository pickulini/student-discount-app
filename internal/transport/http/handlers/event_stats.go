package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

// Статистика «моих ивентов» — для любого пользователя-организатора.

type eventStatsTotals struct {
	Events     int     `json:"events"`
	Published  int     `json:"published"`
	Pending    int     `json:"pending"`
	Drafts     int     `json:"drafts"`
	Rejected   int     `json:"rejected"`
	Upcoming   int     `json:"upcoming"`
	Going      int     `json:"going"`
	Interested int     `json:"interested"`
	Viewers    int     `json:"viewers"`
	Going7d    int     `json:"going_7d"`
	Tickets    int     `json:"tickets"`
	Revenue    float64 `json:"revenue"`
}

// GET /api/v1/events/my/stats — сводка и цифры по каждому ивенту.
func (h *CabinetHandler) MyEventsStats(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.uid(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	list, err := h.repo.OrganizerEventStats(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load stats")
		return
	}
	t := eventStatsTotals{Events: len(list)}
	now := time.Now()
	for _, e := range list {
		switch e.Status {
		case "published":
			t.Published++
		case "pending_review", "pending_partner_approval":
			t.Pending++
		case "draft":
			t.Drafts++
		case "rejected":
			t.Rejected++
		}
		if e.Status == "published" && ((e.EndAt != nil && e.EndAt.After(now)) || (e.EndAt == nil && e.StartAt != nil && e.StartAt.After(now))) {
			t.Upcoming++
		}
		t.Going += e.Going
		t.Interested += e.Interested
		t.Viewers += e.Viewers
		t.Going7d += e.Going7d
		t.Tickets += e.Tickets
		t.Revenue += e.Revenue
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"totals": t, "events": list})
}

// GET /api/v1/events/{id}/stats — подробности по своему ивенту.
func (h *CabinetHandler) MyEventStat(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.uid(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	d, err := h.repo.OrganizerEventStat(r.Context(), userID, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "ивент не найден")
		return
	}
	writeJSON(w, http.StatusOK, d)
}

// TrackEventView — оборачивает показ страницы ивента: отмечает просмотр (в фоне, не задерживая ответ).
func (h *CabinetHandler) TrackEventView(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if userID, ok := h.uid(r); ok {
			if id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64); err == nil {
				go func() {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					_ = h.repo.TrackEventView(ctx, id, userID)
				}()
			}
		}
		next(w, r)
	}
}
