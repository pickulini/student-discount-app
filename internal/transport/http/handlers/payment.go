package handlers

import (
    "encoding/json"
    "fmt"
    "html"
    "io"
    "net/http"
    "net/url"
    "strconv"
    "strings"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"

    "github.com/go-chi/chi/v5"
)

type PaymentHandler struct {
    paymentUsecase *usecase.PaymentUsecase
}

func NewPaymentHandler(pu *usecase.PaymentUsecase) *PaymentHandler {
    return &PaymentHandler{paymentUsecase: pu}
}

type InitPaymentRequest struct {
    Amount float64 `json:"amount"`
    // Куда вернуть после оплаты (относительный путь сайта, например /offers/5/checkout).
    ReturnTo string `json:"return_to"`
}

// safeReturn — только относительный путь нашего сайта: без схемы, хоста и «//».
func safeReturn(p string) string {
    if p == "" || !strings.HasPrefix(p, "/") || strings.HasPrefix(p, "//") || strings.ContainsAny(p, "\\\r\n") {
        return "/wallet"
    }
    return p
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
    token := h.paymentUsecase.GenerateCheckoutToken(paymentID)
    if proto := r.Header.Get("X-Forwarded-Proto"); proto == "https" {
        scheme = "https"
    }
    paymentURL := fmt.Sprintf("%s://%s/payments/sbp/checkout/%d?t=%s", scheme, r.Host, paymentID, token)
    if req.ReturnTo != "" {
        paymentURL += "&r=" + url.QueryEscape(safeReturn(req.ReturnTo))
    }
    writeJSON(w, http.StatusOK, map[string]interface{}{
        "payment_id":  paymentID,
        "payment_url": paymentURL,
        "status":      "pending",
    })
}

func (h *PaymentHandler) ConfirmPayment(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        http.Error(w, "invalid payment id", http.StatusBadRequest)
        return
    }

    // Эта страница не требует логина (эмуляция редиректа на страницу оплаты СБП, куда
    // браузер переходит через window.location, без Authorization-заголовка). Вместо
    // сессии её защищает непредсказуемый токен, который знает только тот, кто получил
    // payment_url из /api/v1/payments/init — иначе любой человек, подобрав ID платежа,
    // мог бы подтвердить чужой платёж и зачислить деньги на чужой баланс.
    token := r.URL.Query().Get("t")
    if !h.paymentUsecase.VerifyCheckoutToken(id, token) {
        http.Error(w, "invalid or missing payment token", http.StatusForbidden)
        return
    }

    payment, err := h.paymentUsecase.GetPaymentByID(r.Context(), id)
    if err != nil {
        http.Error(w, "payment not found", http.StatusNotFound)
        return
    }

    ret := safeReturn(r.URL.Query().Get("r"))
    done := payment.Status == "completed" || payment.Status == "succeeded"

    if r.Method == http.MethodPost {
        if !done {
            if err := h.paymentUsecase.ConfirmPayment(r.Context(), id); err != nil {
                http.Error(w, "failed to confirm payment: "+err.Error(), http.StatusInternalServerError)
                return
            }
        }
        // Страница «Оплачено» — с неё сайт возвращается туда, откуда пришли, а приложение
        // закрывает окно оплаты (ловит адрес /payments/sbp/done).
        http.Redirect(w, r, "/payments/sbp/done?r="+url.QueryEscape(ret)+"&a="+strconv.FormatFloat(payment.Amount, 'f', 0, 64), http.StatusSeeOther)
        return
    }

    w.Header().Set("Content-Type", "text/html; charset=utf-8")
    w.Header().Set("Cache-Control", "no-store")
    body := `
    <div class="brand">СТУДЕНТ−%</div>
    <div class="meta">ОПЛАТА ЧЕРЕЗ СБП · ПЛАТЁЖ № ` + fmt.Sprintf("%06d", payment.ID) + `</div>
    <div class="rule2"></div>
    <div class="row"><span>Пополнение кошелька</span><i></i><span>` + money(payment.Amount) + `</span></div>
    <div class="row"><span>Комиссия</span><i></i><span>0,00</span></div>
    <div class="rule2"></div>
    <div class="total"><span>Итого</span><i></i><b>` + rub(payment.Amount) + `</b></div>
    <div class="rule"></div>`
    if done {
        body += `
    <div class="stamp">✓ Уже оплачено</div>
    <a class="btn" href="` + html.EscapeString(ret) + `">Вернуться</a>`
    } else {
        body += `
    <p class="note">Это учебная эмуляция СБП: деньги не списываются, баланс пополнится сразу после подтверждения.</p>
    <form method="POST" action="` + html.EscapeString(r.URL.RequestURI()) + `">
        <button type="submit" class="btn">Подтвердить оплату</button>
    </form>
    <a class="link" href="` + html.EscapeString(ret) + `">[ Отмена ]</a>`
    }
    w.Write([]byte(checkoutPage("Оплата через СБП", body)))
}

// PaymentDone — «Оплачено»: итог пополнения и возврат назад (на сайт или в приложение).
func (h *PaymentHandler) PaymentDone(w http.ResponseWriter, r *http.Request) {
    ret := safeReturn(r.URL.Query().Get("r"))
    amount, _ := strconv.ParseFloat(r.URL.Query().Get("a"), 64)
    w.Header().Set("Content-Type", "text/html; charset=utf-8")
    w.Header().Set("Cache-Control", "no-store")
    body := `
    <div class="brand">СТУДЕНТ−%</div>
    <div class="meta">ОПЛАТА ЧЕРЕЗ СБП</div>
    <div class="rule2"></div>
    <div class="stamp">✓ Оплачено</div>`
    if amount > 0 {
        body += `
    <div class="big">+` + rub(amount) + `</div>
    <div class="meta">зачислено на кошелёк</div>`
    }
    body += `
    <div class="rule"></div>
    <a class="btn" href="` + html.EscapeString(ret) + `">Продолжить</a>
    <script>setTimeout(function(){ location.replace(` + strconv.Quote(ret) + `) }, 2500)</script>`
    w.Write([]byte(checkoutPage("Оплачено", body)))
}

func money(v float64) string {
    s := strconv.FormatFloat(v, 'f', 2, 64)
    return strings.Replace(groupThousands(s), ".", ",", 1)
}

func rub(v float64) string {
    return groupThousands(strconv.FormatFloat(v, 'f', 0, 64)) + "\u00a0₽"
}

func groupThousands(s string) string {
    intPart, frac := s, ""
    if i := strings.IndexByte(s, '.'); i >= 0 {
        intPart, frac = s[:i], s[i:]
    }
    var b strings.Builder
    for i, c := range intPart {
        if i > 0 && (len(intPart)-i)%3 == 0 {
            b.WriteString("\u00a0")
        }
        b.WriteRune(c)
    }
    return b.String() + frac
}

// checkoutPage — страница в стиле «Чек»: бумажный чек, пунктир, моно-подписи.
// Тема: ?theme=dark|light (приложение), иначе выбор с сайта (localStorage), иначе системная.
func checkoutPage(title, body string) string {
    return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>` + title + ` — Студент−%</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@700&family=Manrope:wght@400&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<script>
(function () {
  var q = new URLSearchParams(location.search).get('theme'), t = q;
  if (t !== 'light' && t !== 'dark') { try { t = localStorage.getItem('theme'); } catch (e) {} }
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
})();
</script>
<style>
:root { --desk:#ededea; --paper:#fff; --ink:#121212; --soft:#6b6b6b; --faint:#a8a8a8; --line:#bdbdbd; --accent:#d12b1f; --on:#fff; color-scheme: light; }
[data-theme=dark] { --desk:#0e0c09; --paper:#e2d5b7; --ink:#2b2118; --soft:#6e5f4a; --faint:#9f8e72; --line:#b3a284; --accent:#b53222; --on:#e2d5b7; --btn:#ece1c8; --btnink:#17140f; color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; background: var(--desk); }
body { font-family: Manrope, -apple-system, sans-serif; color: var(--ink); display: flex; justify-content: center; align-items: flex-start; padding: max(28px, env(safe-area-inset-top)) 20px 40px; min-height: 100vh; }
.wrap { width: 100%; max-width: 400px; margin-top: 6vh; }
.paper { background: var(--paper); padding: 28px 22px 26px; display: flex; flex-direction: column; gap: 14px; text-align: center; }
.tear { height: 7px; background: linear-gradient(135deg, var(--paper) 50%, transparent 50%) 0 -7px / 14px 14px repeat-x, linear-gradient(225deg, var(--paper) 50%, transparent 50%) 0 -7px / 14px 14px repeat-x; }
.brand { font-family: Unbounded, sans-serif; font-weight: 700; font-size: 18px; letter-spacing: -0.02em; }
.meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.04em; color: var(--soft); text-transform: uppercase; }
.rule { border-top: 1px dashed var(--line); }
.rule2 { height: 5px; border-top: 1px dashed var(--ink); border-bottom: 1px dashed var(--ink); }
.row, .total { display: flex; align-items: flex-end; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.03em; text-transform: uppercase; text-align: left; }
.row i, .total i { flex: 1; min-width: 8px; border-top: 1px dashed var(--faint); height: 4px; }
.total span { font-weight: 700; font-size: 13px; }
.total i { height: 10px; }
.total b { font-family: Unbounded, sans-serif; font-size: 30px; line-height: 1; white-space: nowrap; }
.stamp { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); }
.big { font-family: Unbounded, sans-serif; font-weight: 700; font-size: 40px; color: var(--accent); line-height: 1.1; }
.note { font-size: 13px; line-height: 19px; color: var(--soft); margin: 0; }
form { margin: 0; }
.btn { display: block; width: 100%; border: 0; background: var(--ink); color: var(--on); font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; padding: 15px 20px; text-decoration: none; cursor: pointer; }
.btn:active { opacity: .85; }
.link { font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink); text-decoration: none; padding: 6px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="paper">` + body + `
  </div>
  <div class="tear"></div>
</div>
</body>
</html>`
}

func (h *PaymentHandler) WebhookHandler(w http.ResponseWriter, r *http.Request) {
    body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1 MB — вебхук не должен быть больше
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }

    // Без проверки подписи любой человек в интернете мог бы POST-ить сюда
    // {"payment_id": N, "status": "succeeded"} и зачислять деньги на произвольный счёт.
    signature := r.Header.Get("X-Webhook-Signature")
    if !h.paymentUsecase.VerifyWebhookSignature(body, signature) {
        writeError(w, http.StatusUnauthorized, "invalid webhook signature")
        return
    }

    var req struct {
        PaymentID int64  `json:"payment_id"`
        Status    string `json:"status"`
    }
    if err := json.Unmarshal(body, &req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    if err := h.paymentUsecase.ProcessWebhook(r.Context(), req.PaymentID, req.Status); err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
