package sse

import (
    "encoding/json"
    "log"
    "sync"
)

// Message — единая структура события SSE.
type Message struct {
    Event string          `json:"event"`
    Data  json.RawMessage `json:"data"`
}

type Hub struct {
    mu          sync.RWMutex
    subscribers map[int64]map[chan []byte]struct{}
}

func NewHub() *Hub {
    return &Hub{
        subscribers: make(map[int64]map[chan []byte]struct{}),
    }
}

func (h *Hub) Subscribe(userID int64) chan []byte {
    ch := make(chan []byte, 32)
    h.mu.Lock()
    defer h.mu.Unlock()
    if h.subscribers[userID] == nil {
        h.subscribers[userID] = make(map[chan []byte]struct{})
    }
    h.subscribers[userID][ch] = struct{}{}
    return ch
}

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

// PublishToUser отправляет событие конкретному user.
func (h *Hub) PublishToUser(userID int64, event string, payload interface{}) {
    raw, err := json.Marshal(payload)
    if err != nil {
        log.Printf("[SSE] marshal error: %v", err)
        return
    }
    msg, _ := json.Marshal(Message{Event: event, Data: raw})

    h.mu.RLock()
    defer h.mu.RUnlock()
    set, ok := h.subscribers[userID]
    if !ok {
        return
    }
    for ch := range set {
        select {
        case ch <- msg:
        default:
        }
    }
}

// Broadcast отправляет событие всем подписчикам.
func (h *Hub) Broadcast(event string, payload interface{}) {
    raw, err := json.Marshal(payload)
    if err != nil {
        log.Printf("[SSE] broadcast marshal error: %v", err)
        return
    }
    msg, _ := json.Marshal(Message{Event: event, Data: raw})

    h.mu.RLock()
    defer h.mu.RUnlock()
    for _, set := range h.subscribers {
        for ch := range set {
            select {
            case ch <- msg:
            default:
            }
        }
    }
}

// Publish — сохраняем обратную совместимость: пуш notification конкретному юзеру.
func (h *Hub) Publish(userID int64, payload interface{}) {
    h.PublishToUser(userID, "notification", payload)
}
