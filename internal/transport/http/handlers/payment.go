package handlers

import (
    "encoding/json"
    "net/http"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
)

type PaymentHandler struct {
    paymentUsecase *usecase.PaymentUsecase
}

func NewPaymentHandler(pu *usecase.PaymentUsecase) *PaymentHandler {
    return &PaymentHandler{paymentUsecase: pu}
}

type DepositRequest struct {
    Amount float64 `json:"amount"`
}

func (h *PaymentHandler) Deposit(w http.ResponseWriter, r *http.Request) {
    var req DepositRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }

    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }

    newBalance, err := h.paymentUsecase.Deposit(r.Context(), usecase.DepositInput{
        UserID: userID,
        Amount: req.Amount,
    })
    if err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }

    writeJSON(w, http.StatusOK, map[string]interface{}{
        "status":      "success",
        "new_balance": newBalance,
    })
}
