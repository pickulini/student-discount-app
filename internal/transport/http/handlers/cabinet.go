package handlers

import (
    "your-project/internal/journal"
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "strconv"
    "strings"
    "time"

    "github.com/go-chi/chi/v5"
    "your-project/internal/domain"
    "your-project/internal/repository"
    "your-project/internal/repository/postgres"
    "your-project/internal/third_party/qrcode"
    "your-project/internal/transport/http/middleware"
    "your-project/internal/usecase"
)

// CabinetHandler — API кабинета партнёра (экраны P01–P09 макета «Чек»)
// и витринные эндпоинты предложений.
type CabinetHandler struct {
    Admin     *AdminCabinetHandler // админ-панель (A01–A10), задаётся в main
    repo      *postgres.CabinetRepo
    offerRepo repository.OfferRepository
    companyUC *usecase.CompanyUsecase
    orderUC   *usecase.OrderUsecase
    subUC     *usecase.SubscriptionUsecase
}

func NewCabinetHandler(repo *postgres.CabinetRepo, offerRepo repository.OfferRepository, companyUC *usecase.CompanyUsecase, orderUC *usecase.OrderUsecase, subUC *usecase.SubscriptionUsecase) *CabinetHandler {
    return &CabinetHandler{repo: repo, offerRepo: offerRepo, companyUC: companyUC, orderUC: orderUC, subUC: subUC}
}

// ---------- helpers ----------

func (h *CabinetHandler) uid(r *http.Request) (int64, bool) {
    v, ok := r.Context().Value(middleware.UserIDKey).(int64)
    return v, ok
}

// scope возвращает компании партнёра, опционально сужая до ?company_id=.
func (h *CabinetHandler) scope(w http.ResponseWriter, r *http.Request) ([]int64, int64, bool) {
    userID, ok := h.uid(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return nil, 0, false
    }
    ids, err := h.repo.UserCompanyIDs(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load companies")
        return nil, 0, false
    }
    if raw := r.URL.Query().Get("company_id"); raw != "" && raw != "all" {
        cid, err := strconv.ParseInt(raw, 10, 64)
        if err != nil {
            writeError(w, http.StatusBadRequest, "invalid company_id")
            return nil, 0, false
        }
        for _, id := range ids {
            if id == cid {
                return []int64{cid}, userID, true
            }
        }
        writeError(w, http.StatusForbidden, "not your company")
        return nil, 0, false
    }
    return ids, userID, true
}

func nextPayoutDate(now time.Time) time.Time {
    now = now.In(mskLoc())
    d := time.Date(now.Year(), now.Month(), domain.PayoutDayOfMonth, 0, 0, 0, 0, now.Location())
    if !d.After(now) {
        d = d.AddDate(0, 1, 0)
    }
    return d
}

func mskLoc() *time.Location {
    loc, err := time.LoadLocation("Europe/Moscow")
    if err != nil {
        return time.FixedZone("MSK", 3*3600)
    }
    return loc
}

// ---------- GET /merchant/cabinet/config ----------

func (h *CabinetHandler) Config(w http.ResponseWriter, r *http.Request) {
    writeJSON(w, http.StatusOK, map[string]interface{}{
        "commission_rate":     domain.CommissionRate,
        "payout_day_of_month": domain.PayoutDayOfMonth,
        "next_payout_date":    nextPayoutDate(time.Now()).Format("2006-01-02"),
    })
}

// ---------- GET /merchant/cabinet/companies ----------

func (h *CabinetHandler) Companies(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.uid(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    ids, err := h.repo.UserCompanyIDs(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load companies")
        return
    }
    list, err := h.repo.Companies(r.Context(), ids)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load companies: "+err.Error())
        return
    }
    writeJSON(w, http.StatusOK, list)
}

// ---------- GET /merchant/cabinet/overview ----------

func (h *CabinetHandler) Overview(w http.ResponseWriter, r *http.Request) {
    ids, userID, ok := h.scope(w, r)
    if !ok {
        return
    }
    ctx := r.Context()
    now := time.Now()
    to := postgres.StartOfDayMSK(now).AddDate(0, 0, 1)
    from := to.AddDate(0, 0, -30)
    prevFrom := from.AddDate(0, 0, -30)

    money, err := h.repo.Money(ctx, ids, from, to)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load money: "+err.Error())
        return
    }
    daily, err := h.repo.DailyOrders(ctx, ids, from, to, true)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load daily: "+err.Error())
        return
    }
    total, _ := h.repo.CountOrders(ctx, ids, from, to, true)
    prev, _ := h.repo.CountOrders(ctx, ids, prevFrom, from, true)
    attention, _ := h.repo.Attention(ctx, ids)
    txs, _, _, _ := h.repo.Transactions(ctx, ids, "", time.Unix(0, 0), to, 5, 0)
    allIDs, _ := h.repo.UserCompanyIDs(ctx, userID)
    companies, _ := h.repo.Companies(ctx, allIDs)
    writeJSON(w, http.StatusOK, map[string]interface{}{
        "money":            money,
        "next_payout_date": nextPayoutDate(now).Format("2006-01-02"),
        "redeemed_daily":   daily,
        "redeemed_total":   total,
        "redeemed_prev":    prev,
        "prev_from":        prevFrom,
        "attention":        attention,
        "transactions":     txs,
        "companies":        companies,
        "updated_at":       now,
    })
}

// ---------- GET /merchant/cabinet/transactions ----------

func (h *CabinetHandler) Transactions(w http.ResponseWriter, r *http.Request) {
    ids, _, ok := h.scope(w, r)
    if !ok {
        return
    }
    q := r.URL.Query()
    now := time.Now()
    to := postgres.StartOfDayMSK(now).AddDate(0, 0, 1)
    from := postgres.StartOfDayMSK(now).AddDate(0, 0, -29)
    if v := q.Get("from"); v != "" {
        if t, err := time.ParseInLocation("2006-01-02", v, mskLoc()); err == nil {
            from = t
        }
    }
    if v := q.Get("to"); v != "" {
        if t, err := time.ParseInLocation("2006-01-02", v, mskLoc()); err == nil {
            to = t.AddDate(0, 0, 1)
        }
    }
    perPage := 20
    if v, err := strconv.Atoi(q.Get("per_page")); err == nil && v > 0 && v <= 1000 {
        perPage = v
    }
    page := 1
    if v, err := strconv.Atoi(q.Get("page")); err == nil && v > 0 {
        page = v
    }
    items, total, sum, err := h.repo.Transactions(r.Context(), ids, q.Get("type"), from, to, perPage, (page-1)*perPage)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load transactions: "+err.Error())
        return
    }
    sumFrom := postgres.StartOfDayMSK(now).AddDate(0, 0, -29)
    sumTo := postgres.StartOfDayMSK(now).AddDate(0, 0, 1)
    money30, _ := h.repo.Money(r.Context(), ids, sumFrom, sumTo)
    moneyAll, _ := h.repo.Money(r.Context(), ids, time.Unix(0, 0), sumTo)
    pages := (total + perPage - 1) / perPage
    if pages == 0 {
        pages = 1
    }
    writeJSON(w, http.StatusOK, map[string]interface{}{
        "items":        items,
        "total_count":  total,
        "total_amount": sum,
        "page":         page,
        "pages":        pages,
        "from":         from.Format("2006-01-02"),
        "to":           to.AddDate(0, 0, -1).Format("2006-01-02"),
        "summary": map[string]interface{}{
            "credited_30d":     money30.Credited,
            "refunds_30d":      money30.Refunds,
            "paid_out":         moneyAll.PaidOut,
            "balance":          moneyAll.Balance,
            "next_payout_date": nextPayoutDate(now).Format("2006-01-02"),
        },
    })
}

// ---------- GET /merchant/cabinet/stats ----------

func (h *CabinetHandler) Stats(w http.ResponseWriter, r *http.Request) {
    ids, userID, ok := h.scope(w, r)
    if !ok {
        return
    }
    days := 30
    switch r.URL.Query().Get("period") {
    case "7":
        days = 7
    case "90":
        days = 90
    }
    ctx := r.Context()
    now := time.Now()
    to := postgres.StartOfDayMSK(now).AddDate(0, 0, 1)
    from := to.AddDate(0, 0, -days)
    prevFrom := from.AddDate(0, 0, -days)

    counts, err := h.repo.OfferCounts(ctx, ids)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed: "+err.Error())
        return
    }
    uses, _ := h.repo.CountOrders(ctx, ids, from, to, false)
    usesPrev, _ := h.repo.CountOrders(ctx, ids, prevFrom, from, false)
    daily, _ := h.repo.DailyOrders(ctx, ids, from, to, false)
    money, _ := h.repo.Money(ctx, ids, from, to)
    top, _ := h.repo.TopOffers(ctx, ids, from, to, 5)
    events, _ := h.repo.Events(ctx, userID, ids, from, to)
    writeJSON(w, http.StatusOK, map[string]interface{}{
        "from":             from,
        "to":               to.Add(-time.Second),
        "prev_from":        prevFrom,
        "offers":           counts,
        "uses":             uses,
        "uses_prev":        usesPrev,
        "daily":            daily,
        "avg_check":        money.AvgCheck,
        "avg_discount_pct": money.AvgDiscountPct,
        "top_offers":       top,
        "events":           events,
    })
}

// ---------- GET /merchant/cabinet/offers/{id} ----------

func (h *CabinetHandler) Offer(w http.ResponseWriter, r *http.Request) {
    ids, _, ok := h.scope(w, r)
    if !ok {
        return
    }
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    offer, err := h.offerRepo.GetByID(r.Context(), id)
    if err != nil || offer == nil {
        writeError(w, http.StatusNotFound, "offer not found")
        return
    }
    own := false
    for _, cid := range ids {
        if offer.CompanyID != nil && *offer.CompanyID == cid {
            own = true
        }
    }
    if !own {
        writeError(w, http.StatusForbidden, "not your offer")
        return
    }
    list := []domain.Offer{*offer}
    _ = h.repo.EnrichOffers(r.Context(), list)
    writeJSON(w, http.StatusOK, list[0])
}

// ---------- Касса ----------

type redeemCheckResult struct {
    Order       *postgres.RedeemOrder `json:"order,omitempty"`
    ErrorCode   string                `json:"error_code,omitempty"`
    ErrorTitle  string                `json:"error_title,omitempty"`
    ErrorText   string                `json:"error_text,omitempty"`
}

func fmtRu(t time.Time) string {
    return t.In(mskLoc()).Format("02.01 в 15:04")
}

// validate проверяет, можно ли погасить заказ этим партнёром в выбранной точке.
func (h *CabinetHandler) validate(ro *postgres.RedeemOrder, ids []int64, locationID *int64) redeemCheckResult {
    if ro == nil {
        return redeemCheckResult{ErrorCode: "not_found", ErrorTitle: "Код не найден",
            ErrorText: "Проверьте цифры и буквы — код состоит из 4 цифр и 4 букв из чека студента."}
    }
    res := redeemCheckResult{Order: ro}
    own := false
    for _, id := range ids {
        if id == ro.CompanyID {
            own = true
        }
    }
    if !own {
        return redeemCheckResult{ErrorCode: "other_company", ErrorTitle: "Заказ другой компании",
            ErrorText: "Этот код оформлен не в вашей компании. Попросите студента проверить, куда он оформил заказ."}
    }
    switch ro.Status {
    case "completed":
        where := "на этой точке"
        if ro.RedeemedAddress != "" {
            where = "на точке " + ro.RedeemedAddress
        }
        when := ""
        if ro.RedeemedAt != nil {
            when = " " + fmtRu(*ro.RedeemedAt)
        }
        res.ErrorCode, res.ErrorTitle = "already_redeemed", "Код уже погашен"
        res.ErrorText = "Заказ № " + orderNo(ro.ID) + " погашен" + when + " " + where + ". Повторно использовать нельзя."
    case "created":
        res.ErrorCode, res.ErrorTitle = "not_paid", "Заказ не оплачен"
        res.ErrorText = "Студент ещё не подтвердил оплату в приложении. Попросите завершить оплату."
    case "refunded", "cancelled", "failed":
        res.ErrorCode, res.ErrorTitle = "cancelled", "Заказ отменён"
        res.ErrorText = "По заказу № " + orderNo(ro.ID) + " оформлен возврат или отмена. Погасить его нельзя."
    case "paid":
        if locationID != nil && ro.LocationID != nil && *ro.LocationID != *locationID {
            res.ErrorCode, res.ErrorTitle = "other_location", "Заказ другой точки"
            res.ErrorText = "Код оформлен в " + ro.CompanyName
            if ro.LocationAddress != "" {
                res.ErrorText += " (" + ro.LocationAddress + ")"
            }
            res.ErrorText += ". Попросите студента проверить адрес."
        }
    }
    return res
}

func orderNo(id int64) string {
    s := strconv.FormatInt(id, 10)
    for len(s) < 6 {
        s = "0" + s
    }
    return s
}

func (h *CabinetHandler) RedeemCheck(w http.ResponseWriter, r *http.Request) {
    ids, _, ok := h.scope(w, r)
    if !ok {
        return
    }
    var req struct {
        Code       string `json:"code"`
        LocationID *int64 `json:"location_id"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    digits, redeem, err := postgres.ParseOrderCode(req.Code)
    if err != nil {
        writeJSON(w, http.StatusOK, redeemCheckResult{ErrorCode: "bad_format", ErrorTitle: "Неверный формат",
            ErrorText: "Код из чека — 4 цифры и 4 буквы, например 0512 · KX7Q."})
        return
    }
    ro, err := h.repo.FindByCode(r.Context(), digits, redeem)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed: "+err.Error())
        return
    }
    writeJSON(w, http.StatusOK, h.validate(ro, ids, req.LocationID))
}

func (h *CabinetHandler) Redeem(w http.ResponseWriter, r *http.Request) {
    ids, userID, ok := h.scope(w, r)
    if !ok {
        return
    }
    orderID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    var req struct {
        LocationID *int64 `json:"location_id"`
    }
    _ = json.NewDecoder(r.Body).Decode(&req)
    ro, err := h.repo.OrderForRedeem(r.Context(), orderID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed: "+err.Error())
        return
    }
    check := h.validate(ro, ids, req.LocationID)
    if check.ErrorCode != "" {
        writeJSON(w, http.StatusConflict, check)
        return
    }
    done, err := h.repo.MarkRedeemed(r.Context(), orderID, userID, req.LocationID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed: "+err.Error())
        return
    }
    if !done {
        ro, _ = h.repo.OrderForRedeem(r.Context(), orderID)
        writeJSON(w, http.StatusConflict, h.validate(ro, ids, req.LocationID))
        return
    }
    journal.Log(r.Context(), userID, journal.OrderRedeem, "order", orderID, "Заказ погашен на кассе")
    ro, _ = h.repo.OrderForRedeem(r.Context(), orderID)
    writeJSON(w, http.StatusOK, redeemCheckResult{Order: ro})
}

func (h *CabinetHandler) RedeemReject(w http.ResponseWriter, r *http.Request) {
    ids, userID, ok := h.scope(w, r)
    if !ok {
        return
    }
    orderID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    var req struct {
        Reason string `json:"reason"`
    }
    _ = json.NewDecoder(r.Body).Decode(&req)
    req.Reason = strings.TrimSpace(req.Reason)
    if req.Reason == "" {
        writeError(w, http.StatusBadRequest, "укажите причину отказа")
        return
    }
    ro, err := h.repo.OrderForRedeem(r.Context(), orderID)
    if err != nil || ro == nil {
        writeError(w, http.StatusNotFound, "order not found")
        return
    }
    check := h.validate(ro, ids, nil)
    if check.ErrorCode != "" {
        writeJSON(w, http.StatusConflict, check)
        return
    }
    amount := h.orderUC.OrderAmount(r.Context(), orderID)
    if err := h.orderUC.RefundOrder(r.Context(), orderID, "отказ на кассе: "+req.Reason); err != nil {
        writeError(w, http.StatusBadRequest, err.Error())
        return
    }
    journal.Log(r.Context(), userID, journal.OrderRefund, "order", orderID,
        fmt.Sprintf("Возврат %s ₽ · отказ на кассе: «%s»", fmtRub(amount), req.Reason))
    writeJSON(w, http.StatusOK, map[string]string{"message": "refunded"})
}

func (h *CabinetHandler) RedeemToday(w http.ResponseWriter, r *http.Request) {
    ids, _, ok := h.scope(w, r)
    if !ok {
        return
    }
    from := postgres.StartOfDayMSK(time.Now())
    rows, err := h.repo.RedeemedBetween(r.Context(), ids, from, from.AddDate(0, 0, 1))
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed: "+err.Error())
        return
    }
    sum := 0.0
    for _, x := range rows {
        sum += x.Amount
    }
    writeJSON(w, http.StatusOK, map[string]interface{}{"count": len(rows), "sum": sum, "items": rows})
}

// ---------- Витрина ----------

// ListOffers — публичный список с названием компании и галереей.
func (h *CabinetHandler) ListOffers(w http.ResponseWriter, r *http.Request) {
    filters := map[string]interface{}{}
    if tags := r.URL.Query().Get("tags"); tags != "" {
        filters["tags"] = tags
    }
    limit := 200
    if v, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && v > 0 && v <= 500 {
        limit = v
    }
    offers, err := h.companyUC.ListOffers(r.Context(), filters, limit, 0)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load offers")
        return
    }
    _ = h.repo.EnrichOffers(r.Context(), offers)
    writeJSON(w, http.StatusOK, offers)
}

// GetOffer — страница предложения (D02): оффер, компания, статистика компании.
func (h *CabinetHandler) GetOffer(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    offer, err := h.offerRepo.GetByID(r.Context(), id)
    if err != nil || offer == nil || offer.IsEvent || (offer.Status != "published" && offer.Status != "expired") {
        writeError(w, http.StatusNotFound, "offer not found")
        return
    }
    list := []domain.Offer{*offer}
    _ = h.repo.EnrichOffers(r.Context(), list)
    resp := map[string]interface{}{"offer": list[0]}
    if offer.CompanyID != nil {
        var viewer int64
        if v, ok := r.Context().Value(middleware.UserIDKey).(int64); ok {
            viewer = v
        }
        if stats, err := h.subUC.Stats(r.Context(), *offer.CompanyID, viewer); err == nil {
            resp["company_stats"] = stats
        }
        if companies, err := h.repo.Companies(r.Context(), []int64{*offer.CompanyID}); err == nil && len(companies) == 1 {
            c := companies[0]
            resp["company"] = map[string]interface{}{
                "id":             c.ID,
                "name":           c.Name,
                "category_label": c.CategoryLabel,
                "locations":      c.Locations,
                "subscribers":    c.Subscribers,
                "offers_active":  c.OffersActive,
            }
        }
    }
    writeJSON(w, http.StatusOK, resp)
}

// MerchantOffers — все предложения компаний партнёра (без ивентов), с обогащением.
func (h *CabinetHandler) MerchantOffers(w http.ResponseWriter, r *http.Request) {
    ids, _, ok := h.scope(w, r)
    if !ok {
        return
    }
    out := []domain.Offer{}
    for _, cid := range ids {
        list, err := h.offerRepo.GetByCompanyID(r.Context(), cid)
        if err != nil {
            writeError(w, http.StatusInternalServerError, "failed to load offers")
            return
        }
        for _, o := range list {
            if !o.IsEvent {
                out = append(out, o)
            }
        }
    }
    _ = h.repo.EnrichOffers(r.Context(), out)
    writeJSON(w, http.StatusOK, out)
}

// OrderQR — QR-код из чека студента (D03). Только владелец заказа.
// Внутри — код погашения «0512KX7Q», его читает «Касса» партнёра.
func (h *CabinetHandler) OrderQR(w http.ResponseWriter, r *http.Request) {
    userID, ok := h.uid(r)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    orderID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    order, err := h.orderUC.GetOrderByID(r.Context(), userID, orderID)
    if err != nil || order == nil {
        writeError(w, http.StatusNotFound, "order not found")
        return
    }
    code := strings.ReplaceAll(postgres.FormatOrderCode(order.ID, order.RedeemCode), " · ", "")
    qr, err := qrcode.New(code, qrcode.Medium)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "qr failed")
        return
    }
    qr.DisableBorder = true
    bm := qr.Bitmap()
    n := len(bm)
    var b strings.Builder
    fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" shape-rendering="crispEdges"><path fill="#121212" d="`, n, n)
    for y, row := range bm {
        for x, on := range row {
            if on {
                fmt.Fprintf(&b, "M%d %dh1v1h-1z", x, y)
            }
        }
    }
    b.WriteString(`"/></svg>`)
    w.Header().Set("Content-Type", "image/svg+xml")
    w.Header().Set("Cache-Control", "private, max-age=3600")
    w.Write([]byte(b.String()))
}

// UserExtras — прокси к репозиторию для обогащения /users/me.
func (h *CabinetHandler) UserExtras(ctx context.Context, userID int64) map[string]interface{} {
    return h.repo.UserExtras(ctx, userID)
}

// PublicStats — GET /api/v1/stats/public, без авторизации.
func (h *CabinetHandler) PublicStats(w http.ResponseWriter, r *http.Request) {
    s, err := h.repo.PublicStats(r.Context())
    if err != nil {
        writeError(w, http.StatusInternalServerError, "stats unavailable")
        return
    }
    writeJSON(w, http.StatusOK, s)
}

// MyVerification — GET /api/v1/students/verify: последняя заявка текущего пользователя.
func (h *CabinetHandler) MyVerification(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    v, err := h.repo.LatestVerification(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]interface{}{"verification": v})
}

// EventsMeta — GET /api/v1/events/meta?ids=1,2,3
func (h *CabinetHandler) EventsMeta(w http.ResponseWriter, r *http.Request) {
    ids := []int64{}
    for _, s := range strings.Split(r.URL.Query().Get("ids"), ",") {
        if v, err := strconv.ParseInt(strings.TrimSpace(s), 10, 64); err == nil && v > 0 {
            ids = append(ids, v)
        }
        if len(ids) >= 300 {
            break
        }
    }
    userID, _ := r.Context().Value(middleware.UserIDKey).(int64)
    meta, err := h.repo.EventsMeta(r.Context(), userID, ids)
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, meta)
}

// EventFriends — GET /api/v1/events/friends[?event_id=N]
func (h *CabinetHandler) EventFriends(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    eventID, _ := strconv.ParseInt(r.URL.Query().Get("event_id"), 10, 64)
    list, err := h.repo.FriendsAtEvents(r.Context(), userID, eventID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, list)
}

// WalletOperations — GET /api/v1/wallet/operations?month=YYYY-MM
func (h *CabinetHandler) WalletOperations(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    msk := time.FixedZone("MSK", 3*3600)
    now := time.Now().In(msk)
    from := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, msk)
    if m := r.URL.Query().Get("month"); m != "" {
        if t, err := time.ParseInLocation("2006-01", m, msk); err == nil {
            from = t
        }
    }
    to := from.AddDate(0, 1, 0)
    ops, err := h.repo.WalletOperations(r.Context(), userID, from, to)
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    months, _ := h.repo.WalletMonths(r.Context(), userID)
    writeJSON(w, http.StatusOK, map[string]interface{}{
        "month":      from.Format("2006-01"),
        "operations": ops,
        "months":     months,
    })
}

// ReferralInvitees — GET /api/v1/referral/invitees
func (h *CabinetHandler) ReferralInvitees(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    list, err := h.repo.ReferralInvitees(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, list)
}

// FriendsOverview — GET /api/v1/friends/overview
func (h *CabinetHandler) FriendsOverview(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    res, err := h.repo.FriendsOverview(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, res)
}

// ProfileExtras — GET /api/v1/users/by-username/{username}/extras (гостю тоже можно)
func (h *CabinetHandler) ProfileExtras(w http.ResponseWriter, r *http.Request) {
    viewerID, _ := r.Context().Value(middleware.UserIDKey).(int64)
    res, err := h.repo.ProfileExtras(r.Context(), chi.URLParam(r, "username"), viewerID)
    if err != nil {
        writeError(w, http.StatusNotFound, "user not found")
        return
    }
    writeJSON(w, http.StatusOK, res)
}

// SubscriptionsOverview — GET /api/v1/subscriptions/overview
func (h *CabinetHandler) SubscriptionsOverview(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    list, err := h.repo.SubscriptionsOverview(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, list)
}

// SupportOverview — GET /api/v1/support/overview
func (h *CabinetHandler) SupportOverview(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    list, err := h.repo.SupportTickets(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, list)
}

// SupportThread — GET /api/v1/support/tickets/{id}/thread
func (h *CabinetHandler) SupportThread(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    list, err := h.repo.SupportThread(r.Context(), id, userID)
    if err != nil {
        writeError(w, http.StatusNotFound, "ticket not found")
        return
    }
    writeJSON(w, http.StatusOK, list)
}

// SupportClose — POST /api/v1/support/tickets/{id}/close
func (h *CabinetHandler) SupportClose(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err := h.repo.CloseSupportTicket(r.Context(), id, userID); err != nil {
        writeError(w, http.StatusNotFound, "ticket not found")
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"status": "closed"})
}

// UsernameAvailable — GET /api/v1/users/username-available?u=anna_p
func (h *CabinetHandler) UsernameAvailable(w http.ResponseWriter, r *http.Request) {
    userID, _ := r.Context().Value(middleware.UserIDKey).(int64)
    u := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(r.URL.Query().Get("u"), "@")))
    valid := len(u) >= 3 && len(u) <= 30
    for _, c := range u {
        if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_') {
            valid = false
        }
    }
    if !valid {
        writeJSON(w, http.StatusOK, map[string]interface{}{"valid": false, "available": false})
        return
    }
    taken, err := h.repo.UsernameTaken(r.Context(), u, userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, map[string]interface{}{"valid": true, "available": !taken})
}

// SetSearchable — PATCH /api/v1/users/me/search-visibility {"searchable": true}
func (h *CabinetHandler) SetSearchable(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }
    var req struct {
        Searchable bool `json:"searchable"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    if err := h.repo.SetSearchable(r.Context(), userID, req.Searchable); err != nil {
        writeError(w, http.StatusInternalServerError, "failed")
        return
    }
    writeJSON(w, http.StatusOK, map[string]bool{"searchable": req.Searchable})
}
