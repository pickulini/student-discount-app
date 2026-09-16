package handlers

import (
    "net/http"
    "your-project/internal/usecase"
)

type TagHandler struct {
    tagUsecase *usecase.TagUsecase
}

func NewTagHandler(tu *usecase.TagUsecase) *TagHandler {
    return &TagHandler{tagUsecase: tu}
}

func (h *TagHandler) List(w http.ResponseWriter, r *http.Request) {
    tags, err := h.tagUsecase.List(r.Context())
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to load tags")
        return
    }
    writeJSON(w, http.StatusOK, tags)
}
