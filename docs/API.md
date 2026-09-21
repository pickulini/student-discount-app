# API Reference

Базовый URL: `/api/v1`
Формат: JSON
Авторизация: `Authorization: Bearer <JWT>`
Real-time: SSE `/api/v1/notifications/stream?token=<JWT>`

---

## Auth

### POST /auth/register
Регистрация. Автоопределение вуза по домену email.

Body:
```json
{
  "email": "student@msu.ru",
  "password": "12345678",
  "full_name": "Иван Иванов",
  "university_id": null,
  "course": 3,
  "referral_code": "ABC123"
}
```

Ответ 201: `{"user": {...}, "token": "..."}`

### POST /auth/login
Body: `{"email": "x@y.z", "password": "..."}`
Ответ 200: `{"user": {...}, "token": "..."}`

### POST /students/verify
Отправить заявку на верификацию. Требует авторизации.

---

## Users

### GET /users/me
Профиль + приватность + балансы + is_vip.

### PATCH /users/me
```json
{
  "nickname": "Артём",
  "username": "artem_x",
  "avatar_url": "/uploads/abc.png",
  "privacy_allow_subscriptions": true
}
```

### PATCH /users/me/privacy
```json
{"email_visibility": "private", "friends_list_visibility": "friends"}
```

Допустимые поля: `avatar_visibility`, `email_visibility`, `university_visibility`,
`friends_list_visibility`, `subscribers_visibility`, `subscriptions_visibility`,
`attending_events_visibility`, `organizing_events_visibility`, `offers_visibility`,
`statistics_visibility`.

Значения: `public` | `friends` | `private`.

### GET /users/me/notification-settings
Возвращает `{enabled, friends, events, offers}`.

### PATCH /users/me/notification-settings
Body: `{"enabled": true, "friends": false}`

### GET /users/transactions?limit=50&offset=0

### GET /users/by-username/{username}
Публичный профиль с флагами видимости полей.

### GET /users/by-username/{username}/companies
Компании партнёра. Фильтр по `offers_visibility`.

### GET /users/by-username/{username}/events
Ивенты организатора. Фильтр по `organizing_events_visibility`.

### GET /users/by-username/{username}/attending
Ивенты, куда идёт юзер. Фильтр по `attending_events_visibility`.

### GET /users/by-username/{username}/subscriptions
Компании, на которые подписан юзер. Фильтр по `subscriptions_visibility`.

---

## Offers

### GET /offers?tags=slug1,slug2&limit=50&offset=0
### GET /offers/nearby?lat=&lng=&radius=

---

## Tags

### GET /tags
### GET /tags/popular?limit=15
### GET /tags/search?q=скид&limit=10

---

## Orders

### POST /orders
Body: `{"offer_id": 12, "location_id": null, "bonus_points": 0}`

### GET /orders
### GET /orders/{id}
### POST /orders/{id}/confirm
### POST /orders/{id}/refund

---

## Wallet

### GET /wallet
### POST /payments/init
Body: `{"amount": 500}`

---

## Referral

### GET /referral/code
### GET /referral/stats

---

## Friends

### GET /friends
### GET /friends/search?q=artem
### POST /friends/requests
Body: `{"user_id": 5}`
### POST /friends/requests/{id}/accept
### POST /friends/requests/{id}/reject
### POST /friends/requests/{id}/cancel
### GET /friends/requests/incoming
### GET /friends/requests/outgoing
### GET /friends/status/{userId}
### DELETE /friends/{userId}

---

## Subscriptions

### POST /companies/{id}/subscribe
### DELETE /companies/{id}/subscribe
### GET /subscriptions/companies
### GET /subscriptions/companies/ids
### GET /companies/{id}/stats

---

## Events

### POST /events
Только verified student / merchant / admin.

```json
{
  "title": "Встреча",
  "start_at": "2026-11-01T18:00:00Z",
  "end_at": "2026-11-01T21:00:00Z",
  "event_privacy": "public|friends|subscribers|university|invite_only",
  "recurrence_rule": "FREQ=WEEKLY",
  "recurrence_until": "2026-12-31T23:59:59Z"
}
```

### GET /events
### GET /events/my
### GET /events/{id}
### POST /events/{id}/submit
### POST /events/{id}/schedule
### POST /events/{id}/rsvp
Body: `{"status": "interested"|"none"}`
### DELETE /events/{id}/schedule

---

## Notifications

### GET /notifications/stream?token=<JWT>
SSE-стрим.

События: `connected`, `notification`, `support_message`, `new_support_ticket`,
`offer_pending_review`, `event_pending_review`, `verification_pending`.

### GET /notifications?limit=50&offset=0
### GET /notifications?filter=unread
### GET /notifications/unread/count
### POST /notifications/{id}/read
### POST /notifications/read-all
### DELETE /notifications/{id}
### DELETE /notifications/all

---

## Support

### POST /support/tickets
Body: `{"subject": "Тест", "first_message": "..."}`
### GET /support/tickets
### GET /support/tickets/{id}/messages
### POST /support/tickets/{id}/messages
Body: `{"message": "..."}`

---

## Merchant

Требуется роль `merchant`.

### GET /merchant/companies
### GET /merchant/offers
### POST /merchant/offers
Принимает `hashtags: ["еда", "#кофе"]`.
### PUT /merchant/offers/{id}
### POST /merchant/offers/{id}/submit
### POST /merchant/offers/{id}/accept-edits
### POST /merchant/offers/{id}/reject-edits
Body: `{"comment": "..."}`
### GET /merchant/balance
### GET /merchant/transactions
### GET /merchant/events
### GET /merchant/events/stats
### POST /merchant/upload

---

## Admin

Требуется роль `admin`.

### Users
- GET /admin/users
- PUT /admin/users/role — Body: `{"user_id": 1, "role": "admin"}`
- PATCH /admin/users/{id}/university — Body: `{"university_id": 1}`
- GET /admin/users/{id}/stats

### Companies
- GET /admin/companies
- POST /admin/companies
- PUT /admin/companies/{id}
- DELETE /admin/companies?id=1

### Offers
- GET /admin/offers
- GET /admin/offers/{id}
- POST /admin/offers
- PUT /admin/offers/{id} — правки админа
- PUT /admin/offers/{id}/moderate — Body: `{"action": "publish|reject", "reason": "..."}`
- PUT /admin/offers/{id}/archive
- DELETE /admin/offers?id=1

### Verifications
- GET /admin/verifications
- PUT /admin/verifications/{id}

### Tags
- GET /admin/tags?status=pending

### Support
- GET /admin/support/tickets
- PUT /admin/support/tickets/{id}/status
- POST /admin/support/tickets/{id}/messages

### Statistics
- GET /admin/statistics
- GET /admin/audit-logs

---

## Uploads

### POST /users/upload-avatar
### POST /merchant/upload
### POST /admin/upload

multipart/form-data, поле `file`.
Возвращает `{"url": "/uploads/abc123.png"}`.

---

## Ошибки

Все: `{"error": "текст"}`.

| Код | Значение |
|-----|----------|
| 400 | Неверный запрос |
| 401 | Нет/просрочен токен |
| 403 | Нет прав |
| 404 | Не найдено |
| 409 | Конфликт |
| 500 | Ошибка сервера |

---

## Приватность

| Поле | Где применяется |
|------|----------------|
| avatar_visibility | /users/by-username/{u} |
| email_visibility | /users/by-username/{u} |
| university_visibility | PublicProfile UI |
| friends_list_visibility | friends_count |
| offers_visibility | /users/by-username/{u}/companies |
| subscriptions_visibility | /users/by-username/{u}/subscriptions |
| organizing_events_visibility | /users/by-username/{u}/events |
| attending_events_visibility | /users/by-username/{u}/attending |
| statistics_visibility | /companies/{id}/stats |

---

## SSE-протокол

```
event: connected
data: {}

event: notification
data: {"id":50,"type":"friend_request","title":"...","link":"/friends",...}

event: support_message
data: {"ticket_id":1,"user_id":2,"message":"...","is_internal":false}
```

Клиент автопереподключается (backoff 1s → 30s).
