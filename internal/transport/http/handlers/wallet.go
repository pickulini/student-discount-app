package handlers

import (
    "net/http"
    "your-project/internal/repository"
    "your-project/internal/transport/http/middleware"
)

type WalletHandler struct {
    accountRepo repository.AccountRepository
    bonusRepo   repository.BonusRepository
}

func NewWalletHandler(accountRepo repository.AccountRepository, bonusRepo repository.BonusRepository) *WalletHandler {
    return &WalletHandler{
        accountRepo: accountRepo,
        bonusRepo:   bonusRepo,
    }
}

func (h *WalletHandler) GetWallet(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(middleware.UserIDKey).(int64)
    if !ok {
        writeError(w, http.StatusUnauthorized, "unauthorized")
        return
    }

    account, err := h.accountRepo.GetByUserIDAndType(r.Context(), userID, "cash")
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load account")
        return
    }

    bonusAcc, err := h.bonusRepo.GetByUserID(r.Context(), userID)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load bonus account")
        return
    }

    writeJSON(w, http.StatusOK, map[string]interface{}{
        "balance": account.Balance,
        "bonus":   bonusAcc.Balance,
    })
}
