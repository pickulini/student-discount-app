package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"your-project/internal/domain"
	"your-project/internal/usecase"

	"github.com/go-chi/chi/v5"
)

type AdminHandler struct {
	adminUsecase *usecase.AdminUsecase
}

func NewAdminHandler(au *usecase.AdminUsecase) *AdminHandler {
	return &AdminHandler{adminUsecase: au}
}

// ---- Пользователи ----
func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.adminUsecase.ListUsers(r.Context(), 100, 0)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load users")
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *AdminHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not implemented")
}

func (h *AdminHandler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID int64  `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := h.adminUsecase.UpdateUserRole(r.Context(), req.UserID, req.Role); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update role")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "role updated"})
}

// ---- Компании ----
func (h *AdminHandler) ListCompanies(w http.ResponseWriter, r *http.Request) {
	companies, err := h.adminUsecase.ListCompanies(r.Context(), 100, 0)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load companies")
		return
	}
	writeJSON(w, http.StatusOK, companies)
}

func (h *AdminHandler) CreateCompany(w http.ResponseWriter, r *http.Request) {
	var company domain.Company
	if err := json.NewDecoder(r.Body).Decode(&company); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := h.adminUsecase.CreateCompany(r.Context(), &company); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create company")
		return
	}
	writeJSON(w, http.StatusCreated, company)
}

func (h *AdminHandler) UpdateCompany(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not implemented")
}

func (h *AdminHandler) DeleteCompany(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		writeError(w, http.StatusBadRequest, "missing id")
		return
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.adminUsecase.DeleteCompany(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete company")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "company deleted"})
}

// ---- Предложения ----
func (h *AdminHandler) ListOffers(w http.ResponseWriter, r *http.Request) {
	offers, err := h.adminUsecase.ListOffers(r.Context(), 100, 0)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load offers")
		return
	}
	writeJSON(w, http.StatusOK, offers)
}

func (h *AdminHandler) CreateOffer(w http.ResponseWriter, r *http.Request) {
	var offer domain.Offer
	if err := json.NewDecoder(r.Body).Decode(&offer); err != nil {
		log.Printf("CreateOffer decode error: %v", err)
		writeError(w, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	log.Printf("CreateOffer received: %+v", offer)
	if err := h.adminUsecase.CreateOffer(r.Context(), &offer); err != nil {
		log.Printf("CreateOffer usecase error: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to create offer")
		return
	}
	writeJSON(w, http.StatusCreated, offer)
}

func (h *AdminHandler) UpdateOffer(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotImplemented, "not implemented")
}

func (h *AdminHandler) DeleteOffer(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		writeError(w, http.StatusBadRequest, "missing id")
		return
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.adminUsecase.DeleteOffer(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete offer")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "offer deleted"})
}

// ---- Верификации ----
func (h *AdminHandler) ListVerifications(w http.ResponseWriter, r *http.Request) {
	verifications, err := h.adminUsecase.ListVerifications(r.Context(), 100, 0)
	if err != nil {
		log.Printf("ListVerifications error: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to load verifications")
		return
	}
	writeJSON(w, http.StatusOK, verifications)
}

func (h *AdminHandler) UpdateVerification(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := h.adminUsecase.UpdateVerification(r.Context(), id, req.Status, ""); err != nil {
		log.Printf("UpdateVerification error: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to update verification")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "verification updated"})
}

// ---- Статистика ----
func (h *AdminHandler) GetStatistics(w http.ResponseWriter, r *http.Request) {
	stats, err := h.adminUsecase.GetStatistics(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load statistics")
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (h *AdminHandler) GetUserDetailedStats(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	stats, err := h.adminUsecase.GetUserDetailedStats(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load user stats")
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (h *AdminHandler) ModerateOffer(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid offer id")
		return
	}
	var req struct {
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := h.adminUsecase.ModerateOffer(r.Context(), id, req.Action); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "offer moderated"})
}
