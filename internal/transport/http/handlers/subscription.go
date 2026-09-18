package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"your-project/internal/transport/http/middleware"
	"your-project/internal/usecase"

	"github.com/go-chi/chi/v5"
)

type SubscriptionHandler struct {
	uc *usecase.SubscriptionUsecase
}

func NewSubscriptionHandler(uc *usecase.SubscriptionUsecase) *SubscriptionHandler {
	return &SubscriptionHandler{uc: uc}
}

func (h *SubscriptionHandler) userID(r *http.Request) (int64, bool) {
	id, ok := r.Context().Value(middleware.UserIDKey).(int64)
	return id, ok
}

func (h *SubscriptionHandler) companyID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	return id, err == nil && id > 0
}

// POST /api/v1/companies/{id}/subscribe
func (h *SubscriptionHandler) Subscribe(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.userID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	companyID, ok := h.companyID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid company id")
		return
	}
	if err := h.uc.Subscribe(r.Context(), userID, companyID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"subscribed": true})
}

// DELETE /api/v1/companies/{id}/subscribe
func (h *SubscriptionHandler) Unsubscribe(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.userID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	companyID, ok := h.companyID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid company id")
		return
	}
	if err := h.uc.Unsubscribe(r.Context(), userID, companyID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"subscribed": false})
}

// GET /api/v1/subscriptions/companies
func (h *SubscriptionHandler) MyCompanies(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.userID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	list, err := h.uc.MyCompanies(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load subscriptions")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

// GET /api/v1/subscriptions/companies/ids
func (h *SubscriptionHandler) SubscribedIDs(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.userID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	ids, err := h.uc.SubscribedIDs(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed")
		return
	}
	if ids == nil {
		ids = []int64{}
	}
	writeJSON(w, http.StatusOK, ids)
}

// GET /api/v1/companies/{id}/stats
func (h *SubscriptionHandler) CompanyStats(w http.ResponseWriter, r *http.Request) {
	companyID, ok := h.companyID(r)
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid company id")
		return
	}
	stats, err := h.uc.Stats(r.Context(), companyID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed")
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// helper для JSON-запроса с телом
var _ = json.NewDecoder
