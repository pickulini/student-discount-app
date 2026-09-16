package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
    "github.com/go-chi/chi/v5"
)

type OrderHandler struct {
    orderUsecase *usecase.OrderUsecase
}

func NewOrderHandler(ou *usecase.OrderUsecase) *OrderHandler {
    return &OrderHandler{orderUsecase: ou}
}

type CreateOrderRequest struct {
    OfferID     int64   `json:"offer_id"`
    LocationID  *int64  `json:"location_id,omitempty"`
    BonusPoints float64 `json:"bonus_points"`
}

func (h *OrderHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
    var req CreateOrderRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }

    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }

    input := usecase.CreateOrderInput{
        UserID:      userID,
        OfferID:     req.OfferID,
        LocationID:  req.LocationID,
        BonusPoints: req.BonusPoints,
    }

    order, err := h.orderUsecase.CreateOrder(r.Context(), input)
    if err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusCreated, order)
}

func (h *OrderHandler) GetUserOrders(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    orders, err := h.orderUsecase.GetUserOrders(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load orders")
        return
    }
    writeJSON(w, http.StatusOK, orders)
}

// UpdateStatus – обновление статуса заказа (только админ)
func (h *OrderHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid order id")
        return
    }

    var req struct {
        Status string `json:"status"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }

    if err := h.orderUsecase.UpdateOrderStatus(r.Context(), id, req.Status); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "status updated"})
}

// CancelOrder – отмена заказа пользователем
func (h *OrderHandler) CancelOrder(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid order id")
        return
    }

    if err := h.orderUsecase.CancelOrder(r.Context(), id); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "order cancelled"})
}
