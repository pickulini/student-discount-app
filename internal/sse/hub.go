package sse

import (
    "encoding/json"
    "log"
    "sync"
)

// Hub — in-memory шина для SSE. Подписчик = user_id + канал.
type Hub struct {
    mu          sync.RWMutex
    subscribers map[int64]map[chan []byte]struct{} // userID -> set of channels
}

func NewHub() *Hub {
    return &Hub{
        subscribers: make(map[int64]map[chan []byte]struct{}),
    }
}

// Subscribe создаёт канал для userID.
func (h *Hub) Subscribe(userID int64) chan []byte {
    ch := make(chan []byte, 16)
    h.mu.Lock()
    defer h.mu.Unlock()
    if h.subscribers[userID] == nil {
        h.subscribers[userID] = make(map[chan []byte]struct{})
    }
    h.subscribers[userID][ch] = struct{}{}
    return ch
}

// Unsubscribe удаляет канал.
func (h *Hub) Unsubscribe(userID int64, ch chan []byte) {
    h.mu.Lock()
    defer h.mu.Unlock()
    if set, ok := h.subscribers[userID]; ok {
        if _, ok := set[ch]; ok {
            delete(set, ch)
            close(ch)
        }
        if len(set) == 0 {
            delete(h.subscribers, userID)
        }
    }
}

// Publish отправляет payload всем подписчикам userID (не блокирует).
func (h *Hub) Publish(userID int64, payload interface{}) {
    data, err := json.Marshal(payload)
    if err != nil {
        log.Printf("[SSE] marshal error: %v", err)
        return
    }

    h.mu.RLock()
    defer h.mu.RUnlock()
    set, ok := h.subscribers[userID]
    if !ok {
        return
    }
    for ch := range set {
        select {
        case ch <- data:
        default:
            // клиент не успевает — пропускаем
        }
    }
}
