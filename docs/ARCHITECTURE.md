# Architecture

## Слои

```
HTTP (transport) → Usecase (бизнес-логика) → Repository (интерфейсы) → Postgres (pgxpool)
```

- Domain не зависит ни от чего.
- Usecase зависит от интерфейсов репозиториев.
- Хендлеры не лезут в репозитории напрямую.
- Всё связывается в `cmd/api/main.go` (ручной DI).

---

## Domain

`internal/domain/*.go` — структуры и константы. Без логики.

Enum — константы + валидаторы:
```go
const OrderStatusCreated = "created"
func IsValidOrderTransition(from, to string) bool { ... }
```

---

## Repositories

Все интерфейсы в `internal/repository/interfaces.go`.

**Правила:**
- `(*domain.X, error)` для одиночных.
- `[]domain.X, error` для списков, всегда `make(..., 0)` чтобы JSON отдавал `[]`, не `null`.
- Транзакции — `pgx.Tx` + суффикс `Tx`.
- `FOR UPDATE` — отдельный метод с `Tx`.

---

## Usecase

`internal/usecase/*.go`. Конструктор `NewXxxUsecase(deps)`.

- Бизнес-валидация здесь, HTTP-валидация в handler.
- Не возвращаем HTTP-коды.
- Транзакция открывается в usecase, если операция многошаговая.

---

## Handlers

`internal/transport/http/handlers/`.

- Достать user: `r.Context().Value(middleware.UserIDKey).(int64)`
- Парсить: `json.NewDecoder(r.Body).Decode(&req)`
- Отвечать: `writeJSON(w, status, data)` / `writeError(w, status, msg)`

---

## Middleware

| Файл | Что делает |
|------|-----------|
| auth.go | JWT → user_id в контекст. Fallback `?token=` для SSE |
| optional_auth.go | Мягкий — не падает без токена |
| admin.go | role='admin' |
| merchant.go | role='merchant' |
| cors.go | CORS |
| logging.go | Логи запросов |
| recovery.go | Ловит панику |
| request_info.go | IP в контекст |
| audit.go | Пишет в audit_logs |

---

## SSE (real-time)

`internal/sse/hub.go` — in-memory pub/sub.

```go
hub := sse.NewHub()
ch := hub.Subscribe(userID)
defer hub.Unsubscribe(userID, ch)

hub.PublishToUser(userID, "notification", payload)
hub.Broadcast("support_message", payload)
```

Message:
```go
type Message struct {
    Event string
    Data  json.RawMessage
}
```

События: `notification`, `support_message`, `new_support_ticket`,
`offer_pending_review`, `event_pending_review`, `verification_pending`.

---

## Уведомления

`NotificationUsecase.Create`:
1. Проверить настройки юзера
2. INSERT notifications
3. Publish в SSE

`NotifyAdmins` — рассылает всем админам.

Категории: friends, events, offers, support, system.

---

## Воркеры

| Воркер | Что делает | Интервал |
|--------|-----------|----------|
| verification_worker.go | Помечает expired верификации | 1 раз в сутки |
| bonus_credit_worker.go | Зачисляет referral награды после refund window (14 дней) | 30 минут |
| notification_cleanup_worker.go | Удаляет уведомления старше 60 дней | 1 раз в сутки |

Все стартуют в `main.go` через `worker.StartXxx(ctx, deps)`.

---

## Nullable и JSONB

```go
var name sql.NullString
var count sql.NullInt64
err := row.Scan(&name, &count)
if name.Valid { x.Name = &name.String }
if count.Valid { x.Count = &count.Int64 }
```

При вставке nil:
```go
var companyID interface{}
if o.CompanyID > 0 { companyID = o.CompanyID }
tx.Exec(ctx, `INSERT INTO offers (company_id) VALUES ($1)`, companyID)
```

JSONB → `json.RawMessage` в domain, `[]byte` при scan.

---

## Транзакции

```go
tx, err := u.db.Begin(ctx)
if err != nil { return err }
defer tx.Rollback(ctx)
// ... через tx ...
return tx.Commit(ctx)
```

---

## Порядок в main.go

1. Config
2. DB pool
3. Репозитории
4. Воркеры
5. Usecases (зависимости — раньше зависимых)
6. Handlers
7. Router
8. HTTP server

**Важно:** если usecase A зависит от B — B создаётся раньше.

---

## Ошибки

`internal/domain/errors.go`:
```go
var ErrUserNotFound = errors.New("user not found")
```

В usecase — `errors.New(...)` для бизнес-ошибок.
В handler — `writeError(w, http.StatusBadRequest, err.Error())`.
