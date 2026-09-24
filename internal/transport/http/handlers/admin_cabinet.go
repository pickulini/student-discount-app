package handlers

import (
    "strings"
    "your-project/internal/util"
    "encoding/json"
    "your-project/internal/journal"
    "github.com/go-chi/chi/v5"
    "fmt"
    "net/http"
    "strconv"
    "time"

    "your-project/internal/repository/postgres"
    "your-project/internal/transport/http/middleware"
)

// AdminCabinetHandler — эндпоинты админ-панели по макетам A01–A10.
type AdminCabinetHandler struct {
    repo *postgres.AdminRepo
    Cab  *postgres.CabinetRepo // операции кошелька в карточке пользователя
}

func NewAdminCabinetHandler(repo *postgres.AdminRepo) *AdminCabinetHandler {
    return &AdminCabinetHandler{repo: repo}
}

// fmtRub: 1450 → «1 450», 240.5 → «240,50».
func fmtRub(v float64) string {
    neg := v < 0
    if neg {
        v = -v
    }
    whole := int64(v)
    cents := int64((v-float64(whole))*100 + 0.5)
    if cents == 100 {
        whole++
        cents = 0
    }
    s := strconv.FormatInt(whole, 10)
    var b []byte
    for i, c := range []byte(s) {
        if i > 0 && (len(s)-i)%3 == 0 {
            b = append(b, []byte("\u00a0")...)
        }
        b = append(b, c)
    }
    out := string(b)
    if cents > 0 {
        out += "," + fmt.Sprintf("%02d", cents)
    }
    if neg {
        out = "−" + out
    }
    return out
}

func adminID(r *http.Request) int64 {
    id, _ := r.Context().Value(middleware.UserIDKey).(int64)
    return id
}

func qInt(r *http.Request, key string, def int) int {
    if v, err := strconv.Atoi(r.URL.Query().Get(key)); err == nil {
        return v
    }
    return def
}

// GET /api/v1/admin/counters — бейджи меню и строка «СЕГОДНЯ».
func (h *AdminCabinetHandler) Counters(w http.ResponseWriter, r *http.Request) {
    c, err := h.repo.Counters(r.Context())
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, c)
}

// GET /api/v1/admin/dashboard?period=today|30d|all
func (h *AdminCabinetHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
    d, err := h.repo.Dashboard(r.Context(), r.URL.Query().Get("period"))
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, d)
}

// GET /api/v1/admin/journal?group=&actor=&day=2006-01-02&page=1
func (h *AdminCabinetHandler) Journal(w http.ResponseWriter, r *http.Request) {
    f := postgres.JournalFilter{Group: r.URL.Query().Get("group"), Limit: qInt(r, "limit", 20)}
    if f.Limit > 1000 {
        f.Limit = 1000
    }
    page := qInt(r, "page", 1)
    if page < 1 {
        page = 1
    }
    f.Offset = (page - 1) * f.Limit
    if a := r.URL.Query().Get("actor"); a == "system" {
        f.ActorID = -1
    } else if v, err := strconv.ParseInt(a, 10, 64); err == nil {
        f.ActorID = v
    }
    if d := r.URL.Query().Get("day"); d != "" {
        // Сутки считаем по Москве, как видит их админ.
        if t, err := time.ParseInLocation("2006-01-02", d, time.FixedZone("MSK", 3*3600)); err == nil {
            f.Day = &t
        }
    }
    items, total, err := h.repo.Journal(r.Context(), f)
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    actors, _ := h.repo.JournalActors(r.Context())
    writeJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": total, "page": page, "limit": f.Limit, "actors": actors})
}

// GET /api/v1/admin/moderation?kind=offers|events&tab=pending|partner|published|rejected|draft|expired|archived|all
func (h *AdminCabinetHandler) Moderation(w http.ResponseWriter, r *http.Request) {
    rows, counts, err := h.repo.ModerationList(r.Context(), r.URL.Query().Get("kind") == "events", r.URL.Query().Get("tab"))
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]interface{}{"items": rows, "counts": counts})
}

// GET /api/v1/admin/moderation/{id} — компания, теги, партнёр и история (само предложение — /admin/offers/{id}).
func (h *AdminCabinetHandler) ModerationDetail(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    d, err := h.repo.ModerationDetail(r.Context(), id)
    if err != nil {
        writeError(w, http.StatusNotFound, "предложение не найдено")
        return
    }
    writeJSON(w, http.StatusOK, d)
}

// GET /api/v1/admin/verifications/queue?tab=pending|verified|rejected|expiring|all
func (h *AdminCabinetHandler) Verifications(w http.ResponseWriter, r *http.Request) {
    rows, meta, err := h.repo.Verifications(r.Context(), r.URL.Query().Get("tab"))
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]interface{}{"items": rows, "meta": meta})
}

// GET /api/v1/admin/verifications/{id}
func (h *AdminCabinetHandler) Verification(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    v, err := h.repo.Verification(r.Context(), id)
    if err != nil {
        writeError(w, http.StatusNotFound, "заявка не найдена")
        return
    }
    writeJSON(w, http.StatusOK, v)
}

// GET /api/v1/admin/users/list?filter=&q=&page=&limit=
func (h *AdminCabinetHandler) Users(w http.ResponseWriter, r *http.Request) {
    limit := qInt(r, "limit", 20)
    if limit < 1 || limit > 5000 {
        limit = 20
    }
    page := qInt(r, "page", 1)
    if page < 1 {
        page = 1
    }
    rows, total, counts, err := h.repo.Users(r.Context(), r.URL.Query().Get("filter"), r.URL.Query().Get("q"), limit, (page-1)*limit)
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]interface{}{"items": rows, "total": total, "counts": counts, "page": page, "limit": limit})
}

func pathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
    id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
        return 0, false
    }
    return id, true
}

// GET /api/v1/admin/users/{id}/card
func (h *AdminCabinetHandler) UserCard(w http.ResponseWriter, r *http.Request) {
    id, ok := pathID(w, r)
    if !ok {
        return
    }
    c, err := h.repo.UserCard(r.Context(), id)
    if err != nil {
        writeError(w, http.StatusNotFound, "пользователь не найден")
        return
    }
    resp := map[string]interface{}{"card": c}
    if h.Cab != nil {
        if ops, err := h.Cab.WalletOperations(r.Context(), id, time.Now().AddDate(-1, 0, 0), time.Now().Add(time.Hour)); err == nil {
            if len(ops) > 6 {
                ops = ops[:6]
            }
            resp["operations"] = ops
        }
    }
    writeJSON(w, http.StatusOK, resp)
}

// PUT /api/v1/admin/users/{id}/vip {"on": true}
func (h *AdminCabinetHandler) SetVIP(w http.ResponseWriter, r *http.Request) {
    id, ok := pathID(w, r)
    if !ok {
        return
    }
    var req struct{ On bool `json:"on"` }
    _ = json.NewDecoder(r.Body).Decode(&req)
    if err := h.repo.SetVIP(r.Context(), id, req.On); err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    txt := "VIP включён"
    if !req.On {
        txt = "VIP выключен"
    }
    journal.Log(r.Context(), adminID(r), journal.UserVIP, "user", id, txt)
    writeJSON(w, http.StatusOK, map[string]bool{"is_vip": req.On})
}

// PUT /api/v1/admin/users/{id}/block {"blocked": true}
func (h *AdminCabinetHandler) SetBlocked(w http.ResponseWriter, r *http.Request) {
    id, ok := pathID(w, r)
    if !ok {
        return
    }
    if id == adminID(r) {
        writeError(w, http.StatusBadRequest, "нельзя заблокировать самого себя")
        return
    }
    var req struct{ Blocked bool `json:"blocked"` }
    _ = json.NewDecoder(r.Body).Decode(&req)
    if err := h.repo.SetActive(r.Context(), id, !req.Blocked); err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    middleware.ForgetSessions()
    txt := "Аккаунт заблокирован"
    if !req.Blocked {
        txt = "Аккаунт разблокирован"
    }
    journal.Log(r.Context(), adminID(r), journal.UserBlock, "user", id, txt)
    writeJSON(w, http.StatusOK, map[string]bool{"blocked": req.Blocked})
}

// POST /api/v1/admin/users/{id}/reset-verification
func (h *AdminCabinetHandler) ResetVerification(w http.ResponseWriter, r *http.Request) {
    id, ok := pathID(w, r)
    if !ok {
        return
    }
    if err := h.repo.ResetVerification(r.Context(), id); err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    journal.Log(r.Context(), adminID(r), journal.VerifyReset, "user", id, "{Сбросил|Сбросила} верификацию")
    writeJSON(w, http.StatusOK, map[string]string{"message": "ok"})
}

// GET /api/v1/admin/universities
func (h *AdminCabinetHandler) Universities(w http.ResponseWriter, r *http.Request) {
    list, err := h.repo.Universities(r.Context())
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, list)
}

// GET /api/v1/admin/companies/list?q=
func (h *AdminCabinetHandler) Companies(w http.ResponseWriter, r *http.Request) {
    list, meta, err := h.repo.Companies(r.Context(), r.URL.Query().Get("q"))
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    tags, err := h.repo.Tags(r.Context())
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]interface{}{"items": list, "meta": meta, "tags": tags})
}

// POST /api/v1/admin/companies/create {"name","description","owner"}
func (h *AdminCabinetHandler) CreateCompany(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Name        string `json:"name"`
        Description string `json:"description"`
        Owner       string `json:"owner"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    req.Name = strings.TrimSpace(req.Name)
    if req.Name == "" {
        writeError(w, http.StatusBadRequest, "укажите название")
        return
    }
    var owner *int64
    if strings.TrimSpace(req.Owner) != "" {
        id, _, err := h.repo.FindUser(r.Context(), req.Owner)
        if err != nil {
            writeError(w, http.StatusBadRequest, "владелец не найден — укажите email, @username или ID")
            return
        }
        owner = &id
    }
    id, err := h.repo.CreateCompany(r.Context(), req.Name, strings.TrimSpace(req.Description), owner)
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    journal.Log(r.Context(), adminID(r), journal.CompanyCreate, "company", id, "{Создал|Создала} компанию «"+req.Name+"»")
    writeJSON(w, http.StatusCreated, map[string]int64{"id": id})
}

// PUT /api/v1/admin/companies/{id}/active {"active": false}
func (h *AdminCabinetHandler) SetCompanyActive(w http.ResponseWriter, r *http.Request) {
    id, ok := pathID(w, r)
    if !ok {
        return
    }
    var req struct{ Active bool `json:"active"` }
    _ = json.NewDecoder(r.Body).Decode(&req)
    name, err := h.repo.SetCompanyActive(r.Context(), id, req.Active)
    if err != nil {
        writeError(w, http.StatusNotFound, "компания не найдена")
        return
    }
    txt := "Компания «" + name + "» снова активна"
    if !req.Active {
        txt = "Компания «" + name + "» выключена"
    }
    journal.Log(r.Context(), adminID(r), journal.CompanyUpdate, "company", id, txt)
    writeJSON(w, http.StatusOK, map[string]bool{"is_active": req.Active})
}

// POST /api/v1/admin/tags/{id}/approve | /reject
func (h *AdminCabinetHandler) ApproveTag(w http.ResponseWriter, r *http.Request) {
    id, ok := pathID(w, r)
    if !ok {
        return
    }
    name, err := h.repo.ApproveTag(r.Context(), id)
    if err != nil {
        writeError(w, http.StatusNotFound, "тег не найден")
        return
    }
    journal.Log(r.Context(), adminID(r), journal.TagApprove, "tag", id, "{Одобрил|Одобрила} тег #"+name)
    writeJSON(w, http.StatusOK, map[string]string{"message": "ok"})
}

func (h *AdminCabinetHandler) RejectTag(w http.ResponseWriter, r *http.Request) {
    id, ok := pathID(w, r)
    if !ok {
        return
    }
    name, err := h.repo.RejectTag(r.Context(), id)
    if err != nil {
        writeError(w, http.StatusNotFound, "тег не найден")
        return
    }
    journal.Log(r.Context(), adminID(r), journal.TagReject, "tag", id, "{Отклонил|Отклонила} тег #"+name)
    writeJSON(w, http.StatusOK, map[string]string{"message": "ok"})
}

// POST /api/v1/admin/tags {"name":"настолки"}
func (h *AdminCabinetHandler) CreateTag(w http.ResponseWriter, r *http.Request) {
    var req struct{ Name string `json:"name"` }
    _ = json.NewDecoder(r.Body).Decode(&req)
    name := strings.ToLower(strings.TrimSpace(strings.TrimLeft(req.Name, "#")))
    slug := util.SlugifyUsername(name)
    if name == "" || slug == "" || len([]rune(name)) > 30 {
        writeError(w, http.StatusBadRequest, "тег: 3–30 символов")
        return
    }
    id, err := h.repo.CreateTag(r.Context(), name, slug, adminID(r))
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    journal.Log(r.Context(), adminID(r), journal.TagCreate, "tag", id, "{Добавил|Добавила} тег #"+name)
    writeJSON(w, http.StatusCreated, map[string]int64{"id": id})
}

// GET /api/v1/admin/support/queue?tab=open|in_progress|resolved|all
func (h *AdminCabinetHandler) Tickets(w http.ResponseWriter, r *http.Request) {
    list, counts, err := h.repo.Tickets(r.Context(), r.URL.Query().Get("tab"))
    if err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, map[string]interface{}{"items": list, "counts": counts})
}

// GET /api/v1/admin/support/{id}
func (h *AdminCabinetHandler) Ticket(w http.ResponseWriter, r *http.Request) {
    id, ok := pathID(w, r)
    if !ok {
        return
    }
    d, err := h.repo.Ticket(r.Context(), id)
    if err != nil {
        writeError(w, http.StatusNotFound, "обращение не найдено")
        return
    }
    writeJSON(w, http.StatusOK, d)
}

// POST /api/v1/admin/support/{id}/note {"message"}
func (h *AdminCabinetHandler) TicketNote(w http.ResponseWriter, r *http.Request) {
    id, ok := pathID(w, r)
    if !ok {
        return
    }
    var req struct{ Message string `json:"message"` }
    _ = json.NewDecoder(r.Body).Decode(&req)
    if strings.TrimSpace(req.Message) == "" {
        writeError(w, http.StatusBadRequest, "пустая заметка")
        return
    }
    if err := h.repo.AddNote(r.Context(), id, adminID(r), strings.TrimSpace(req.Message)); err != nil {
        writeError(w, http.StatusInternalServerError, err.Error())
        return
    }
    writeJSON(w, http.StatusCreated, map[string]string{"message": "ok"})
}
