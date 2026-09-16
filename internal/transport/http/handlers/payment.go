package handlers

import (
    "encoding/json"
    "fmt"
    "net/http"
    "strconv"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
)

type PaymentHandler struct {
    paymentUsecase *usecase.PaymentUsecase
}

func NewPaymentHandler(pu *usecase.PaymentUsecase) *PaymentHandler {
    return &PaymentHandler{paymentUsecase: pu}
}

type InitPaymentRequest struct {
    Amount float64 `json:"amount"`
}

func (h *PaymentHandler) InitiatePayment(w http.ResponseWriter, r *http.Request) {
    var req InitPaymentRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    paymentID, err := h.paymentUsecase.Deposit(r.Context(), usecase.DepositInput{
        UserID: userID,
        Amount: req.Amount,
    })
    if err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    scheme := "http"
    if r.TLS != nil {
        scheme = "https"
    }
    paymentURL := fmt.Sprintf("%s://%s/payments/sbp/checkout/%d", scheme, r.Host, paymentID)
    writeJSON(w, http.StatusOK, map[string]interface{}{
        "payment_id":  paymentID,
        "payment_url": paymentURL,
        "status":      "pending",
    })
}

func (h *PaymentHandler) ConfirmPayment(w http.ResponseWriter, r *http.Request) {
    idStr := r.URL.Path[len("/payments/sbp/checkout/"):]
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        http.Error(w, "invalid payment id", http.StatusBadRequest)
        return
    }

    payment, err := h.paymentUsecase.GetPaymentByID(r.Context(), id)
    if err != nil {
        http.Error(w, "payment not found", http.StatusNotFound)
        return
    }

    if r.Method == http.MethodPost {
        if err := h.paymentUsecase.ConfirmPayment(r.Context(), id); err != nil {
            http.Error(w, "failed to confirm payment: "+err.Error(), http.StatusInternalServerError)
            return
        }
        http.Redirect(w, r, "/wallet", http.StatusFound)
        return
    }

    // Простой HTML без использования Sprintf для избежания ошибок форматирования
    html := `<!DOCTYPE html>
<html>
<head>
    <title>Подтверждение платежа</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f3f4f6;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
        }
        .card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            padding: 40px;
            max-width: 400px;
            width: 100%;
            text-align: center;
        }
        .card h1 { color: #1f2937; font-size: 24px; margin-bottom: 8px; }
        .card .amount { font-size: 36px; font-weight: bold; color: #3b82f6; margin: 16px 0; }
        .card .currency { font-size: 20px; color: #6b7280; }
        .card p { color: #4b5563; line-height: 1.6; }
        .buttons { margin-top: 24px; display: flex; gap: 12px; justify-content: center; }
        .btn {
            padding: 12px 32px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
            text-decoration: none;
            display: inline-block;
        }
        .btn-primary { background: #3b82f6; color: white; }
        .btn-primary:hover { background: #2563eb; }
        .btn-secondary { background: #e5e7eb; color: #1f2937; }
        .btn-secondary:hover { background: #d1d5db; }
        .footer { margin-top: 24px; font-size: 14px; color: #9ca3af; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Подтверждение платежа</h1>
        <p>Вы уверены, что хотите пополнить баланс на сумму</p>
        <div class="amount">` + fmt.Sprintf("%.2f", payment.Amount) + ` <span class="currency">RUB</span></div>
        <p>Платёж будет обработан через СБП (эмуляция).</p>
        <div class="buttons">
            <form method="POST" action="` + r.URL.Path + `">
                <button type="submit" class="btn btn-primary">Подтвердить</button>
            </form>
            <a href="/wallet" class="btn btn-secondary">Отмена</a>
        </div>
        <div class="footer">Студенческая платформа скидок</div>
    </div>
</body>
</html>`
    w.Header().Set("Content-Type", "text/html; charset=utf-8")
    w.Write([]byte(html))
}

func (h *PaymentHandler) WebhookHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        PaymentID int64  `json:"payment_id"`
        Status    string `json:"status"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    if err := h.paymentUsecase.ProcessWebhook(r.Context(), req.PaymentID, req.Status); err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
