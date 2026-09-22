package handlers

import (
    "bytes"
    "crypto/rand"
    "encoding/hex"
    "fmt"
    "io"
    "log"
    "net/http"
    "os"
    "path/filepath"
)

type UploadHandler struct {
    uploadDir string
}

func NewUploadHandler(uploadDir string) *UploadHandler {
    return &UploadHandler{uploadDir: uploadDir}
}

const maxUploadSize = 10 << 20 // 10 MB

// detectImageExt смотрит на реальные байты файла (magic numbers), а не на то, что прислал
// клиент в Content-Type или в имени файла — оба легко подделываются и раньше были
// единственной проверкой здесь, то есть можно было залить что угодно под видом .jpg.
func detectImageExt(data []byte) (string, bool) {
    switch {
    case len(data) >= 3 && bytes.Equal(data[:3], []byte{0xFF, 0xD8, 0xFF}):
        return ".jpg", true
    case len(data) >= 8 && bytes.Equal(data[:8], []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}):
        return ".png", true
    case len(data) >= 6 && (bytes.Equal(data[:6], []byte("GIF87a")) || bytes.Equal(data[:6], []byte("GIF89a"))):
        return ".gif", true
    case len(data) >= 12 && bytes.Equal(data[:4], []byte("RIFF")) && bytes.Equal(data[8:12], []byte("WEBP")):
        return ".webp", true
    default:
        return "", false
    }
}

// Upload принимает multipart/form-data с полем "file", возвращает {"url": "/uploads/..."}
func (h *UploadHandler) Upload(w http.ResponseWriter, r *http.Request) {
    log.Printf("Upload: content-type=%s, content-length=%d", r.Header.Get("Content-Type"), r.ContentLength)

    r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
    if err := r.ParseMultipartForm(maxUploadSize); err != nil {
        log.Printf("Upload: ParseMultipartForm error: %v", err)
        writeError(w, http.StatusBadRequest, "file too large or invalid form")
        return
    }

    file, _, err := r.FormFile("file")
    if err != nil {
        writeError(w, http.StatusBadRequest, "missing file field")
        return
    }
    defer file.Close()

    data, err := io.ReadAll(io.LimitReader(file, maxUploadSize))
    if err != nil {
        writeError(w, http.StatusBadRequest, "failed to read file")
        return
    }

    ext, ok := detectImageExt(data)
    if !ok {
        writeError(w, http.StatusBadRequest, "only jpeg, png, gif or webp images are allowed")
        return
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

    if _, err := dst.Write(data); err != nil {
        writeError(w, http.StatusInternalServerError, "failed to write file")
        return
    }

    url := fmt.Sprintf("/uploads/%s", filename)
    writeJSON(w, http.StatusOK, map[string]string{"url": url})
}
