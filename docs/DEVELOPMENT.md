# Development

Как добавить новую функциональность.

---

## Добавить новую модель

1. `internal/domain/my_entity.go`
2. Миграция `db/migrations/YYYYMMDDHHMMSS_my_entity.up.sql`
3. Интерфейс в `internal/repository/interfaces.go`
4. Реализация `internal/repository/postgres/my_entity_repo.go`
5. Usecase `internal/usecase/my_entity.go`
6. Handler `internal/transport/http/handlers/my_entity.go`
7. `main.go`: repo → usecase → handler
8. Роут в `router_proto.go` + параметр в `NewRouterProto`

**Пример репозитория:**
```go
type MyEntityRepo struct{ db *DB }

func NewMyEntityRepo(db *DB) repository.MyEntityRepository {
    return &MyEntityRepo{db: db}
}

func (r *MyEntityRepo) Create(ctx context.Context, e *domain.MyEntity) error {
    return r.db.Pool.QueryRow(ctx,
        `INSERT INTO my_entities (name, owner_id) VALUES ($1, $2) RETURNING id, created_at`,
        e.Name, e.OwnerID,
    ).Scan(&e.ID, &e.CreatedAt)
}
```

**Пример usecase:**
```go
type MyEntityUsecase struct {
    repo repository.MyEntityRepository
}

func NewMyEntityUsecase(repo repository.MyEntityRepository) *MyEntityUsecase {
    return &MyEntityUsecase{repo: repo}
}

func (u *MyEntityUsecase) Create(ctx context.Context, name string, ownerID int64) (*domain.MyEntity, error) {
    e := &domain.MyEntity{Name: name, OwnerID: ownerID}
    if err := u.repo.Create(ctx, e); err != nil { return nil, err }
    return e, nil
}
```

**Пример handler:**
```go
type MyEntityHandler struct {
    uc *usecase.MyEntityUsecase
}

func NewMyEntityHandler(uc *usecase.MyEntityUsecase) *MyEntityHandler {
    return &MyEntityHandler{uc: uc}
}

func (h *MyEntityHandler) Create(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok { writeError(w, http.StatusUnauthorized, "unauthorized"); return }

    var req struct{ Name string `json:"name"` }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request"); return
    }

    e, err := h.uc.Create(r.Context(), req.Name, userID)
    if err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
    writeJSON(w, http.StatusCreated, e)
}
```

---

## Добавить миграцию

```bash
VERSION=$(date +%Y%m%d%H%M%S)

cat > db/migrations/${VERSION}_my_change.up.sql << 'EOF'
ALTER TABLE users ADD COLUMN bio TEXT;
EOF

cat > db/migrations/${VERSION}_my_change.down.sql << 'EOF'
ALTER TABLE users DROP COLUMN bio;
EOF

docker compose -f docker-compose.prod.yml up migrate
```

**Правила:**
- Всегда `IF NOT EXISTS` / `IF EXISTS`.
- Не редактировать уже применённые миграции.
- `.down.sql` — обратная операция.

---

## Добавить поле в существующую модель

1. Миграция `ALTER TABLE`
2. Поле в `domain.X`
3. Обновить `scanX` (SELECT + Scan) в репозитории
4. Обновить INSERT/UPDATE SQL
5. Handler: добавить в response map (если отдаётся)
6. Frontend: добавить в форму/карточку

**Осторожно с `omitempty`** для int-полей — `0` пропадёт из JSON и фронт увидит `null`.

---

## Добавить приватность

1. Колонка в `users` (default `'public'`)
2. Поле `XxxVisibility string` в `domain.User`
3. `UserRepo.GetByID` подтягивает поле
4. `GetPublicProfileByUsernameWithViewer` — `can_view(...) AS xxx_visible`
5. Флаг `XxxVisible bool` в `domain.UserPublicProfile`
6. В публичном методе usecase — `canViewXxx(ctx, owner, viewerID)`
7. Роут — `middleware.OptionalAuth`
8. Frontend — `if (profile.xxx_visible === false) show 🔒`

---

## Добавить уведомление

1. Константа в `domain/notification.go`:
```go
const NotifMyEvent = "my_event"
```
И добавить в `NotificationCategoryByType`.

2. В нужном usecase:
```go
if u.notifUC != nil {
    _ = u.notifUC.Create(ctx, CreateNotificationInput{
        UserID:        targetUserID,
        Type:          domain.NotifMyEvent,
        Title:         "Заголовок",
        Body:          "Текст",
        Link:          "/my-page",
        ActorID:       &actorID,
        ReferenceType: "my_entity",
        ReferenceID:   &entityID,
    })
}
```

3. Frontend: добавить type в `frontend/src/utils/notificationGroups.js` → `types: [...]`.

---

## Добавить SSE-событие

1. В `NotificationUsecase`:
```go
func (u *NotificationUsecase) BroadcastMyEvent(payload interface{}) {
    u.hub.Broadcast("my_event", payload)
}
```

2. В `useNotifications` (frontend) добавить событие в `CUSTOM_EVENTS`:
```js
const CUSTOM_EVENTS = [
  'support_message',
  'new_support_ticket',
  'my_event',
  // ...
];
```

3. Подписаться в компоненте:
```jsx
useEffect(() => {
  if (!events.my_event) return;
  // обновить данные
}, [events.my_event]);
```

---

## Добавить воркер

```go
// internal/worker/my_worker.go
package worker

func StartMyWorker(ctx context.Context, dep SomeRepo) {
    log.Println("[MY_WORKER] start")
    go func() {
        ticker := time.NewTicker(1 * time.Hour)
        defer ticker.Stop()
        runMyTask(ctx, dep)
        for {
            select {
            case <-ticker.C:
                runMyTask(ctx, dep)
            case <-ctx.Done():
                return
            }
        }
    }()
}
```

В `main.go`:
```go
worker.StartMyWorker(context.Background(), myRepo)
```

---

## Работа с транзакциями

```go
tx, err := u.db.Begin(ctx)
if err != nil { return err }
defer tx.Rollback(ctx)

if err := u.orderRepo.CreateTx(ctx, tx, order); err != nil { return err }
if err := u.accountRepo.UpdateBalanceTx(ctx, tx, id, bal); err != nil { return err }

return tx.Commit(ctx)
```

Метод с транзакцией имеет суффикс `Tx` и принимает `pgx.Tx`.

---

## Работа с nullable

```go
var name sql.NullString
var count sql.NullInt64

err := row.Scan(&name, &count)
if name.Valid { x.Name = &name.String }
if count.Valid { x.Count = &count.Int64 }
```

Для INSERT — не передавай nil напрямую:
```go
var companyID interface{}
if o.CompanyID > 0 { companyID = o.CompanyID }
tx.Exec(ctx, `INSERT INTO offers (company_id) VALUES ($1)`, companyID)
```

---

## Опциональная авторизация

Если роут публичный, но хочет знать viewer'а (для приватности):
```go
r.With(middleware.OptionalAuth(jwtManager)).Get("/api/v1/xxx", handler.GetXxx)
```

В handler:
```go
var viewerID int64
if v, ok := r.Context().Value(middleware.UserIDKey).(int64); ok {
    viewerID = v
}
```

---

## Типичные ошибки

**`undefined: sql`** — забыл `import "database/sql"`.

**`declared and not used: err`** — проверь err или используй `_ =`.

**`cannot use X (variable of type *int64) as int64`** — поле nullable, разыменуй или проверь nil.

**`number of field descriptions must equal number of destinations`** — в SQL N колонок, `Scan` ожидает M. Проверь порядок.

**`null` в JSON для int-поля** — убери `omitempty`.

**SSE рвётся каждые 2 сек** — nginx `proxy_buffering`. См. DEPLOYMENT.md.

**404 на роуте** — забыл зарегистрировать в `router_proto.go`.

---

## Стиль кода

- Табы (go-стандарт).
- Ошибки — lowercase без точки: `errors.New("user not found")`.
- Логи: `log.Printf("[COMPONENT] message: %v", err)`.
  Компоненты: `AUTH`, `NOTIF`, `WORKER`, `BONUS_WORKER`, `NOTIF_CLEANUP`, `VIP_WORKER`, `SSE`.

---

## Проверки перед коммитом

```bash
go build ./...        # сборка
go vet ./...          # статический анализ
go test ./...         # тесты
cd frontend && npm run build && cd ..
```
