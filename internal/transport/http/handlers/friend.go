package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
    "github.com/go-chi/chi/v5"
)

type FriendHandler struct {
    friendUsecase *usecase.FriendUsecase
}

func NewFriendHandler(fu *usecase.FriendUsecase) *FriendHandler {
    return &FriendHandler{friendUsecase: fu}
}

// GET /api/v1/friends/search?q=artem
func (h *FriendHandler) Search(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    q := r.URL.Query().Get("q")
    users, err := h.friendUsecase.SearchUsers(r.Context(), userID, q)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "search failed")
        return
    }
    writeJSON(w, http.StatusOK, users)
}

type SendFriendRequestInput struct {
    UserID int64 `json:"user_id"`
}

// POST /api/v1/friends/requests
func (h *FriendHandler) SendRequest(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    var req SendFriendRequestInput
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    f, err := h.friendUsecase.SendFriendRequest(r.Context(), userID, req.UserID)
    if err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusCreated, f)
}

// POST /api/v1/friends/requests/{id}/accept
func (h *FriendHandler) Accept(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err := h.friendUsecase.AcceptFriendRequest(r.Context(), userID, id); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "accepted"})
}

// POST /api/v1/friends/requests/{id}/reject
func (h *FriendHandler) Reject(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err := h.friendUsecase.RejectFriendRequest(r.Context(), userID, id); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "rejected"})
}

// POST /api/v1/friends/requests/{id}/cancel
func (h *FriendHandler) Cancel(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err := h.friendUsecase.CancelFriendRequest(r.Context(), userID, id); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "cancelled"})
}

// GET /api/v1/friends
func (h *FriendHandler) ListFriends(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    friends, err := h.friendUsecase.ListFriends(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load friends")
        return
    }
    writeJSON(w, http.StatusOK, friends)
}

// GET /api/v1/friends/requests/incoming
func (h *FriendHandler) ListIncoming(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    list, err := h.friendUsecase.ListIncomingRequests(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, list)
}

// GET /api/v1/friends/requests/outgoing
func (h *FriendHandler) ListOutgoing(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    list, err := h.friendUsecase.ListOutgoingRequests(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, list)
}

// GET /api/v1/friends/status/{userId}
func (h *FriendHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    otherID, _ := strconv.ParseInt(chi.URLParam(r, "userId"), 10, 64)
    status, err := h.friendUsecase.GetFriendStatus(r.Context(), userID, otherID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, status)
}

// DELETE /api/v1/friends/{userId}
func (h *FriendHandler) RemoveFriend(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    friendID, _ := strconv.ParseInt(chi.URLParam(r, "userId"), 10, 64)
    if err := h.friendUsecase.RemoveFriend(r.Context(), userID, friendID); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "removed"})
}
