package domain

import "time"

type TransactionHistory struct {
    ID          int64     `json:"id"`
    Type        string    `json:"type"`        // deposit, purchase, bonus, refund
    Amount      float64   `json:"amount"`      // положительное = приход, отрицательное = расход
    Description string    `json:"description"`
    Status      string    `json:"status"`      // completed, pending, failed
    CreatedAt   time.Time `json:"created_at"`
}
