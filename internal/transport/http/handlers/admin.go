package handlers

import (
    "encoding/json"
    "errors"
    "log"
    "net/http"
    "strconv"
    "time"
    "your-project/internal/domain"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
    "github.com/go-chi/chi/v5"
    "github.com/jackc/pgx/v5/pgconn"
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
type AdminCreateOfferRequest struct {
    CompanyID       interface{} `json:"company_id"`
    Title           string      `json:"title"`
    Description     string      `json:"description"`
    DiscountType    string      `json:"discount_type"`
    DiscountValue   float64     `json:"discount_value"`
    StartAt         string      `json:"start_at"`
    EndAt           string      `json:"end_at"`
    Status          string      `json:"status"`
    BonusAllowed    *bool       `json:"bonus_allowed,omitempty"`
    MaxBonusPercent int         `json:"max_bonus_percent"`
    TagIDs          []int64     `json:"tag_ids,omitempty"`
}

func (h *AdminHandler) ListOffers(w http.ResponseWriter, r *http.Request) {
    offers, err := h.adminUsecase.ListOffers(r.Context(), 100, 0)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load offers")
        return
    }
    writeJSON(w, http.StatusOK, offers)
}

func (h *AdminHandler) CreateOffer(w http.ResponseWriter, r *http.Request) {
    var req AdminCreateOfferRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request: "+err.Error())
        return
    }

    var companyID int64
    switch v := req.CompanyID.(type) {
    case float64:
        companyID = int64(v)
    case string:
        if v == "" {
            writeError(w, http.StatusBadRequest, "company_id cannot be empty")
            return
        }
        var err error
        companyID, err = strconv.ParseInt(v, 10, 64)
        if err != nil {
            writeError(w, http.StatusBadRequest, "invalid company_id format")
            return
        }
    default:
        writeError(w, http.StatusBadRequest, "company_id must be number or string")
        return
    }

    var startAt, endAt time.Time
    if req.StartAt != "" {
        t, err := time.Parse(time.RFC3339, req.StartAt)
        if err != nil {
            t, err = time.Parse("2006-01-02T15:04", req.StartAt)
            if err != nil {
                writeError(w, http.StatusBadRequest, "invalid start_at format")
                return
            }
            startAt = t
        } else {
            startAt = t
        }
    } else {
        startAt = time.Now()
    }

    if req.EndAt != "" {
        t, err := time.Parse(time.RFC3339, req.EndAt)
        if err != nil {
            t, err = time.Parse("2006-01-02T15:04", req.EndAt)
            if err != nil {
                writeError(w, http.StatusBadRequest, "invalid end_at format")
                return
            }
            endAt = t
        } else {
            endAt = t
        }
    } else {
        endAt = time.Now().Add(24 * time.Hour)
    }

    bonusAllowed := false
    if req.BonusAllowed != nil {
        bonusAllowed = *req.BonusAllowed
    }

    offer := &domain.Offer{
        CompanyID:       companyID,
        Title:           req.Title,
        Description:     req.Description,
        DiscountType:    req.DiscountType,
        DiscountValue:   req.DiscountValue,
        StartAt:         startAt,
        EndAt:           endAt,
        Status:          req.Status,
        BonusAllowed:    bonusAllowed,
        MaxBonusPercent: req.MaxBonusPercent,
    }

    if err := h.adminUsecase.CreateOffer(r.Context(), offer, req.TagIDs); err != nil {
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
    err = h.adminUsecase.DeleteOffer(r.Context(), id)
    if err != nil {
        var pgErr *pgconn.PgError
        if errors.As(err, &pgErr) && pgErr.Code == "23503" {
            writeError(w, http.StatusConflict, "cannot delete offer with existing orders")
            return
        }
        writeError(w, http.StatusInternalServerError, "failed to delete offer")
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "offer deleted"})
}

func (h *AdminHandler) ModerateOffer(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
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
        writeError(w, http.StatusInternalServerError, "failed to moderate offer")
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "offer moderated"})
}

func (h *AdminHandler) ArchiveOffer(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    if err := h.adminUsecase.ArchiveOffer(r.Context(), id); err != nil {
        writeError(w, http.StatusInternalServerError, "failed to archive offer")
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "offer archived"})
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
        Status          string `json:"status"`
        RejectionReason string `json:"rejection_reason,omitempty"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    // Получаем ID админа из контекста
    adminID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    if err := h.adminUsecase.UpdateVerification(r.Context(), id, req.Status, req.RejectionReason, adminID); err != nil {
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

// ---- Детальная статистика пользователя ----
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
