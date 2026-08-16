package handlers

import (
    "encoding/json"
    "log"
    "net/http"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
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
        log.Printf("invalid request body: %v", err)
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    log.Printf("CreateOrder request: %+v", req)

    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        log.Printf("userID not found in context")
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    log.Printf("userID from context: %d", userID)

    input := usecase.CreateOrderInput{
        UserID:      userID,
        OfferID:     req.OfferID,
        LocationID:  req.LocationID,
        BonusPoints: req.BonusPoints,
    }

    order, err := h.orderUsecase.CreateOrder(r.Context(), input)
    if err != nil {
        log.Printf("CreateOrder error: %v", err)
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
        log.Printf("GetUserOrders error: %v", err)
        writeError(w, http.StatusInternalServerError, "failed to load orders")
        return
    }
    writeJSON(w, http.StatusOK, orders)
}
