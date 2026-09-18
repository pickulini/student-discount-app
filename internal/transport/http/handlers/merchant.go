package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"
    "time"
    "your-project/internal/domain"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
    "github.com/go-chi/chi/v5"
)

type MerchantHandler struct {
    merchantUsecase *usecase.MerchantUsecase
}

func NewMerchantHandler(mu *usecase.MerchantUsecase) *MerchantHandler {
    return &MerchantHandler{merchantUsecase: mu}
}

type CreateOfferRequest struct {
    CompanyID       interface{} `json:"company_id"`
    Title           string  `json:"title"`
    Description     string  `json:"description"`
    DiscountType    string  `json:"discount_type"`
    DiscountValue   float64 `json:"discount_value"`
    StartAt         string  `json:"start_at"`
    EndAt           string  `json:"end_at"`
    BonusAllowed    *bool   `json:"bonus_allowed,omitempty"`
    MaxBonusPercent int     `json:"max_bonus_percent"`
    TagIDs          []int64 `json:"tag_ids,omitempty"`     // legacy
    Hashtags        []string `json:"hashtags,omitempty"`   // новые хештеги
    ImageURL        *string `json:"image_url,omitempty"`
    Address         *string `json:"address,omitempty"`
    Phone           *string `json:"phone,omitempty"`
    Website         *string `json:"website,omitempty"`
    WorkingHours    *string `json:"working_hours,omitempty"`
}

func (h *MerchantHandler) GetUserCompanies(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    companies, err := h.merchantUsecase.GetUserCompanies(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load companies")
        return
    }
    writeJSON(w, http.StatusOK, companies)
}

func (h *MerchantHandler) ListOffers(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    offers, err := h.merchantUsecase.GetUserOffers(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load offers")
        return
    }
    writeJSON(w, http.StatusOK, offers)
}

func (h *MerchantHandler) CreateOffer(w http.ResponseWriter, r *http.Request) {
    var req CreateOfferRequest
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
            writeError(w, http.StatusBadRequest, "invalid company_id")
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
        Status:          "draft",
        BonusAllowed:    bonusAllowed,
        MaxBonusPercent: req.MaxBonusPercent,
        ImageURL:        req.ImageURL,
        Address:         req.Address,
        Phone:           req.Phone,
        Website:         req.Website,
        WorkingHours:    req.WorkingHours,
    }
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    if err := h.merchantUsecase.CreateOffer(r.Context(), userID, offer, req.Hashtags); err != nil {
        writeError(w, http.StatusInternalServerError, "failed to create offer")
        return
    }
    writeJSON(w, http.StatusCreated, offer)
}

func (h *MerchantHandler) SubmitForReview(w http.ResponseWriter, r *http.Request) {
    offerID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid offer id")
        return
    }
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    if err := h.merchantUsecase.SubmitForReview(r.Context(), userID, offerID); err != nil {
        writeError(w, http.StatusInternalServerError, "failed to submit for review")
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "submitted"})
}

func (h *MerchantHandler) GetDailyStats(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    stats, err := h.merchantUsecase.GetDailyStats(r.Context(), userID, 30)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load statistics")
        return
    }
    writeJSON(w, http.StatusOK, stats)
}

// ---- Новые хендлеры для баланса и транзакций ----

func (h *MerchantHandler) GetBalance(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    balance, err := h.merchantUsecase.GetBalance(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load balance")
        return
    }
    writeJSON(w, http.StatusOK, balance)
}

func (h *MerchantHandler) GetTransactions(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    limit := 50
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
    tx, err := h.merchantUsecase.GetTransactions(r.Context(), userID, limit, offset)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load transactions")
        return
    }
    writeJSON(w, http.StatusOK, tx)
}

// UpdateOffer — обновление предложения партнёром
func (h *MerchantHandler) UpdateOffer(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid offer id")
        return
    }

    var req CreateOfferRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request: "+err.Error())
        return
    }

    var companyID int64
    switch v := req.CompanyID.(type) {
    case float64:
        companyID = int64(v)
    case string:
        companyID, _ = strconv.ParseInt(v, 10, 64)
    }

    var startAt, endAt time.Time
    if req.StartAt != "" {
        t, err := time.Parse(time.RFC3339, req.StartAt)
        if err == nil {
            startAt = t
        }
    }
    if req.EndAt != "" {
        t, err := time.Parse(time.RFC3339, req.EndAt)
        if err == nil {
            endAt = t
        }
    }

    bonusAllowed := false
    if req.BonusAllowed != nil {
        bonusAllowed = *req.BonusAllowed
    }

    updated := &domain.Offer{
        CompanyID:       companyID,
        Title:           req.Title,
        Description:     req.Description,
        DiscountType:    req.DiscountType,
        DiscountValue:   req.DiscountValue,
        StartAt:         startAt,
        EndAt:           endAt,
        BonusAllowed:    bonusAllowed,
        MaxBonusPercent: req.MaxBonusPercent,
        ImageURL:        req.ImageURL,
        Address:         req.Address,
        Phone:           req.Phone,
        Website:         req.Website,
        WorkingHours:    req.WorkingHours,
    }

    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }

    if err := h.merchantUsecase.UpdateOffer(r.Context(), userID, id, updated, req.Hashtags); err != nil {
        writeError(w, http.StatusInternalServerError, "failed to update offer: "+err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "offer updated"})
}
