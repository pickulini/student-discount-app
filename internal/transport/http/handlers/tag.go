package handlers

import (
	"net/http"
	"strconv"

	"your-project/internal/transport/http/middleware"
	"your-project/internal/usecase"
)

type TagHandler struct {
	tagUsecase *usecase.TagUsecase
}

func NewTagHandler(tu *usecase.TagUsecase) *TagHandler {
	return &TagHandler{tagUsecase: tu}
}

// GET /api/v1/tags — только active
func (h *TagHandler) List(w http.ResponseWriter, r *http.Request) {
	tags, err := h.tagUsecase.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load tags")
		return
	}
	writeJSON(w, http.StatusOK, tags)
}

// GET /api/v1/tags/popular?limit=12
func (h *TagHandler) Popular(w http.ResponseWriter, r *http.Request) {
	limit := 12
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 50 {
			limit = v
		}
	}
	tags, err := h.tagUsecase.Popular(r.Context(), limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load popular tags")
		return
	}
	writeJSON(w, http.StatusOK, tags)
}

// GET /api/v1/tags/search?q=скид&limit=10
func (h *TagHandler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 50 {
			limit = v
		}
	}
	tags, err := h.tagUsecase.Search(r.Context(), q, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "search failed")
		return
	}
	writeJSON(w, http.StatusOK, tags)
}

// GET /api/v1/admin/tags?status=pending
func (h *TagHandler) AdminList(w http.ResponseWriter, r *http.Request) {
	// защита от не-админа делается в роутере middleware.AdminOnly
	status := r.URL.Query().Get("status")
	limit := 100
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 200 {
			limit = v
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}
	tags, err := h.tagUsecase.ListAllAdmin(r.Context(), status, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load tags")
		return
	}
	writeJSON(w, http.StatusOK, tags)
}

// используется в middleware.UserIDKey, оставим ссылку, чтобы не выпиливать импорт
var _ = middleware.UserIDKey
