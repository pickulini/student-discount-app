package handlers

import (
    "context"
    "encoding/json"
    "net/http"
    "strconv"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
    "github.com/go-chi/chi/v5"
)

type UserHandler struct {
    // Extras дополняет ответ /users/me (курс, вуз, срок статуса).
    Extras func(ctx context.Context, userID int64) map[string]interface{}
    userUsecase *usecase.UserUsecase
}

func NewUserHandler(uu *usecase.UserUsecase) *UserHandler {
    return &UserHandler{userUsecase: uu}
}

func (h *UserHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    user, cashBalance, bonusBalance, err := h.userUsecase.GetProfile(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load profile")
        return
    }
    response := map[string]interface{}{
        "id":                          user.ID,
        "email":                       user.Email,
        "full_name":                   user.FullName,
        "nickname":                    user.Nickname,
        "username":                    user.Username,
        "avatar_url":                  user.AvatarURL,
        "university_id":               user.UniversityID,
        "student_status":              user.StudentStatus,
        "referral_code":               user.ReferralCode,
        "balance":                     cashBalance,
        "bonus_balance":               bonusBalance,
        "is_active":                   user.IsActive,
        "role":                        user.Role,
        "is_vip":                      user.IsVIP,
        "privacy_allow_subscriptions": user.PrivacyAllowSubscriptions,

        "avatar_visibility":            user.AvatarVisibility,
        "email_visibility":             user.EmailVisibility,
        "university_visibility":        user.UniversityVisibility,
        "friends_list_visibility":      user.FriendsListVisibility,
        "subscribers_visibility":       user.SubscribersVisibility,
        "subscriptions_visibility":     user.SubscriptionsVisibility,
        "attending_events_visibility":  user.AttendingEventsVisibility,
        "organizing_events_visibility": user.OrganizingEventsVisibility,
        "offers_visibility":            user.OffersVisibility,
        "statistics_visibility":        user.StatisticsVisibility,

        "created_at": user.CreatedAt,
        "updated_at": user.UpdatedAt,
    }
    if h.Extras != nil {
        for k, v := range h.Extras(r.Context(), user.ID) {
            response[k] = v
        }
    }
    writeJSON(w, http.StatusOK, response)
}

func (h *UserHandler) GetTransactionHistory(w http.ResponseWriter, r *http.Request) {
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
    transactions, err := h.userUsecase.GetTransactionHistory(r.Context(), userID, limit, offset)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load transaction history")
        return
    }
    writeJSON(w, http.StatusOK, transactions)
}

type UpdateProfileRequest struct {
    Nickname                  *string `json:"nickname,omitempty"`
    Username                  *string `json:"username,omitempty"`
    AvatarURL                 *string `json:"avatar_url,omitempty"`
    PrivacyAllowSubscriptions *bool   `json:"privacy_allow_subscriptions,omitempty"`
}

func (h *UserHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }

    var req UpdateProfileRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }

    if err := h.userUsecase.UpdateProfile(r.Context(), userID, req.Nickname, req.Username, req.AvatarURL, req.PrivacyAllowSubscriptions); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }

    user, cashBalance, bonusBalance, err := h.userUsecase.GetProfile(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load profile")
        return
    }

    response := map[string]interface{}{
        "id":                          user.ID,
        "email":                       user.Email,
        "full_name":                   user.FullName,
        "nickname":                    user.Nickname,
        "username":                    user.Username,
        "avatar_url":                  user.AvatarURL,
        "university_id":               user.UniversityID,
        "student_status":              user.StudentStatus,
        "referral_code":               user.ReferralCode,
        "balance":                     cashBalance,
        "bonus_balance":               bonusBalance,
        "is_active":                   user.IsActive,
        "role":                        user.Role,
        "is_vip":                      user.IsVIP,
        "privacy_allow_subscriptions": user.PrivacyAllowSubscriptions,

        "avatar_visibility":            user.AvatarVisibility,
        "email_visibility":             user.EmailVisibility,
        "university_visibility":        user.UniversityVisibility,
        "friends_list_visibility":      user.FriendsListVisibility,
        "subscribers_visibility":       user.SubscribersVisibility,
        "subscriptions_visibility":     user.SubscriptionsVisibility,
        "attending_events_visibility":  user.AttendingEventsVisibility,
        "organizing_events_visibility": user.OrganizingEventsVisibility,
        "offers_visibility":            user.OffersVisibility,
        "statistics_visibility":        user.StatisticsVisibility,

        "created_at": user.CreatedAt,
        "updated_at": user.UpdatedAt,
    }
    writeJSON(w, http.StatusOK, response)
}


// GetPublicProfile — публичный профиль по username, без авторизации
func (h *UserHandler) GetPublicProfile(w http.ResponseWriter, r *http.Request) {
    username := chi.URLParam(r, "username")
    if username == "" {
        writeError(w, http.StatusBadRequest, "username required")
        return
    }
    // viewer из контекста (если залогинен) или 0
    var viewerID int64
    if v, ok := r.Context().Value(middleware.UserIDKey).(int64); ok {
        viewerID = v
    }
    profile, err := h.userUsecase.GetPublicProfileWithViewer(r.Context(), username, viewerID)
    if err != nil {
        writeError(w, http.StatusNotFound, "user not found")
        return
    }
    writeJSON(w, http.StatusOK, profile)
}

// PATCH /api/v1/users/me/privacy
func (h *UserHandler) UpdatePrivacy(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    var req map[string]string
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    if err := h.userUsecase.UpdatePrivacy(r.Context(), userID, req); err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "privacy updated"})
}


// GetPublicCompanies — компании, привязанные к партнёру (публичный)
// Если юзер авторизован — флаг is_subscribed будет для него.
func (h *UserHandler) GetPublicCompanies(w http.ResponseWriter, r *http.Request) {
    username := chi.URLParam(r, "username")
    if username == "" {
        writeError(w, http.StatusBadRequest, "username required")
        return
    }
    // Публичный роут — is_subscribed вычисляем на фронте через /subscriptions/companies/ids
    companies, err := h.userUsecase.GetCompaniesByUsername(r.Context(), username, 0)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load companies")
        return
    }
    writeJSON(w, http.StatusOK, companies)
}


// GET /api/v1/users/by-username/{username}/subscriptions
func (h *UserHandler) GetPublicSubscriptions(w http.ResponseWriter, r *http.Request) {
    username := chi.URLParam(r, "username")
    if username == "" {
        writeError(w, http.StatusBadRequest, "username required")
        return
    }
    var viewerID int64
    if v, ok := r.Context().Value(middleware.UserIDKey).(int64); ok {
        viewerID = v
    }
    subs, err := h.userUsecase.GetSubscriptionsByUsername(r.Context(), username, viewerID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, subs)
}
