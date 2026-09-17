package handlers

import (
    "log"
    "crypto/rand"
    "encoding/hex"
    "fmt"
    "io"
    "net/http"
    "os"
    "path/filepath"
    "strings"
)

type UploadHandler struct {
    uploadDir string
}

func NewUploadHandler(uploadDir string) *UploadHandler {
    return &UploadHandler{uploadDir: uploadDir}
}

// Upload принимает multipart/form-data с полем "file", возвращает {"url": "/uploads/..."}
func (h *UploadHandler) Upload(w http.ResponseWriter, r *http.Request) {
    log.Printf("Upload: content-type=%s, content-length=%d", r.Header.Get("Content-Type"), r.ContentLength)

    if err := r.ParseMultipartForm(10 << 20); err != nil { // 10 MB
        log.Printf("Upload: ParseMultipartForm error: %v", err)
        writeError(w, http.StatusBadRequest, "file too large or invalid form")
        return
    }

    file, header, err := r.FormFile("file")
    if err != nil {
        writeError(w, http.StatusBadRequest, "missing file field")
        return
    }
    defer file.Close()

    // Проверяем тип файла
    contentType := header.Header.Get("Content-Type")
    allowedTypes := map[string]string{
        "image/jpeg": ".jpg",
        "image/png":  ".png",
        "image/webp": ".webp",
        "image/gif":  ".gif",
    }
    ext, ok := allowedTypes[contentType]
    if !ok {
        // Попробуем определить по имени
        ext = strings.ToLower(filepath.Ext(header.Filename))
        if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".gif" {
            writeError(w, http.StatusBadRequest, "only images allowed")
            return
        }
    }

    // Генерируем уникальное имя
    b := make([]byte, 16)
    rand.Read(b)
    filename := hex.EncodeToString(b) + ext

    // Создаём папку
    if err := os.MkdirAll(h.uploadDir, 0755); err != nil {
        writeError(w, http.StatusInternalServerError, "failed to create upload dir")
        return
    }

    // Сохраняем
    dst, err := os.Create(filepath.Join(h.uploadDir, filename))
    if err != nil {
        writeError(w, http.StatusInternalServerError, "failed to save file")
        return
    }
    defer dst.Close()

    if _, err := io.Copy(dst, file); err != nil {
        writeError(w, http.StatusInternalServerError, "failed to write file")
        return
    }

    url := fmt.Sprintf("/uploads/%s", filename)
    writeJSON(w, http.StatusOK, map[string]string{"url": url})
}
