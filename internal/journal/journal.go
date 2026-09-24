// Package journal — журнал действий админки (A10): кто, что и над чем сделал.
// Пишут сюда админские хендлеры, кабинет партнёра и фоновые задачи («СИСТЕМА»).
// Хранилище подключается в main через SetSink — так журнал можно вызывать
// из любого слоя, не протаскивая репозиторий через конструкторы.
package journal

import (
    "context"
    "log"
)

// Типы действий (колонка «ТИП» в журнале).
const (
    VerifyOK       = "verify.ok"
    VerifyReject   = "verify.reject"
    VerifyReset    = "verify.reset"
    BonusRef       = "bonus.ref"
    OfferSubmit    = "offer.submit"
    OfferPublish   = "offer.publish"
    OfferReject    = "offer.reject"
    OfferEdit      = "offer.edit"
    OfferArchive   = "offer.archive"
    OrderRefund    = "order.refund"
    OrderRedeem    = "order.redeem"
    UserRole       = "user.role"
    UserVIP        = "user.vip"
    UserBlock      = "user.block"
    UserUniversity = "user.university"
    CompanyCreate  = "company.create"
    CompanyUpdate  = "company.update"
    CompanyDelete  = "company.delete"
    TagApprove     = "tag.approve"
    TagReject      = "tag.reject"
    TagCreate      = "tag.create"
    SupportStatus  = "support.status"
)

type Entry struct {
    ActorID    int64 // 0 — система
    Action     string
    EntityType string // user | offer | order | company | tag | ticket
    EntityID   int64
    Text       string
}

var sink func(ctx context.Context, e Entry) error

func SetSink(f func(ctx context.Context, e Entry) error) { sink = f }

// Log — записать действие. Ошибки только логируем: журнал не должен ломать само действие.
func Log(ctx context.Context, actorID int64, action, entityType string, entityID int64, text string) {
    if sink == nil {
        return
    }
    e := Entry{ActorID: actorID, Action: action, EntityType: entityType, EntityID: entityID, Text: text}
    if err := sink(context.WithoutCancel(ctx), e); err != nil {
        log.Printf("[journal] %s %s#%d: %v", action, entityType, entityID, err)
    }
}
