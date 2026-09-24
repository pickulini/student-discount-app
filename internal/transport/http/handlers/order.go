package handlers

import (
    "fmt"
    "your-project/internal/journal"
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

// CancelOrder – отмена заказа пользователем (только своего)
func (h *OrderHandler) CancelOrder(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid order id")
        return
    }
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }

    if err := h.orderUsecase.CancelOrder(r.Context(), userID, id); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "order cancelled"})
}

// RefundOrder – возврат средств (только админ)
func (h *OrderHandler) RefundOrder(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid order id")
        return
    }

    var req struct {
        Reason string `json:"reason"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }

    amount := h.orderUsecase.OrderAmount(r.Context(), id)
    if err := h.orderUsecase.RefundOrder(r.Context(), id, req.Reason); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    actor, _ := r.Context().Value(middleware.UserIDKey).(int64)
    txt := fmt.Sprintf("Возврат %s ₽", fmtRub(amount))
    if req.Reason != "" {
        txt += " · «" + req.Reason + "»"
    }
    journal.Log(r.Context(), actor, journal.OrderRefund, "order", id, txt)
    writeJSON(w, http.StatusOK, map[string]string{"message": "order refunded"})
}

// GetOrder – получить заказ по ID
func (h *OrderHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid order id")
        return
    }
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    order, err := h.orderUsecase.GetOrderByID(r.Context(), userID, id)
    if err != nil {
        writeError(w, http.StatusNotFound, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, order)
}

// ConfirmOrder – подтвердить оплату заказа (created → paid)
func (h *OrderHandler) ConfirmOrder(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid order id")
        return
    }
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    if err := h.orderUsecase.ConfirmOrderPayment(r.Context(), userID, id); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"message": "order paid"})
}
