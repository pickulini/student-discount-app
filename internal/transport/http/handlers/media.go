package handlers

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/draw"
	"image/gif"
	"image/jpeg"
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

// MediaHandler отдаёт загруженные картинки (/uploads/...).
//
// Имена файлов случайные и после загрузки не меняются, поэтому ответы кэшируются
// «навсегда». С параметром ?w=N (N из thumbWidths) отдаётся уменьшенная копия:
// короткая сторона — N пикселей (для аватарки 40pt на iPhone это 128 px вместо
// исходных 3000–4000). Копия создаётся один раз и лежит в <uploads>/.thumbs/N/.
type MediaHandler struct {
	dir string
	mu  sync.Mutex
	gen map[string]*sync.Mutex // по одному генератору на файл+размер
	sem chan struct{}          // не больше 4 одновременных уменьшений
}

var thumbWidths = map[int]bool{64: true, 128: true, 256: true, 512: true, 1024: true}

func NewMediaHandler(dir string) *MediaHandler {
	return &MediaHandler{dir: dir, gen: map[string]*sync.Mutex{}, sem: make(chan struct{}, 4)}
}

func (h *MediaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/uploads/")
	name = strings.TrimPrefix(name, "/")
	// Только файлы в корне uploads, без подпапок и «..».
	if name == "" || strings.ContainsAny(name, "/\\") || strings.HasPrefix(name, ".") {
		http.NotFound(w, r)
		return
	}
	src := filepath.Join(h.dir, name)
	st, err := os.Stat(src)
	if err != nil || st.IsDir() {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")

	width, _ := strconv.Atoi(r.URL.Query().Get("w"))
	if !thumbWidths[width] {
		http.ServeFile(w, r, src)
		return
	}
	thumb, err := h.thumb(src, name, width)
	if err != nil {
		// Не получилось (webp, битый файл) — отдаём оригинал.
		http.ServeFile(w, r, src)
		return
	}
	http.ServeFile(w, r, thumb)
}

// thumb возвращает путь к уменьшенной копии, создавая её при первом обращении.
func (h *MediaHandler) thumb(src, name string, width int) (string, error) {
	dst := filepath.Join(h.dir, ".thumbs", strconv.Itoa(width), name)
	if _, err := os.Stat(dst); err == nil {
		return dst, nil
	}

	key := dst
	h.mu.Lock()
	m, ok := h.gen[key]
	if !ok {
		m = &sync.Mutex{}
		h.gen[key] = m
	}
	h.mu.Unlock()
	m.Lock()
	defer func() {
		m.Unlock()
		h.mu.Lock()
		delete(h.gen, key)
		h.mu.Unlock()
	}()
	if _, err := os.Stat(dst); err == nil { // пока ждали, копию сделал другой запрос
		return dst, nil
	}

	h.sem <- struct{}{}
	defer func() { <-h.sem }()

	data, err := os.ReadFile(src)
	if err != nil {
		return "", err
	}
	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	b := img.Bounds()
	short := b.Dx()
	if b.Dy() < short {
		short = b.Dy()
	}
	var out image.Image = img
	if short > width {
		scale := float64(width) / float64(short)
		out = downscale(img, int(float64(b.Dx())*scale+0.5), int(float64(b.Dy())*scale+0.5))
	}
	// Поворот по EXIF — уже на маленькой копии (на 12-мегапиксельном оригинале это секунды).
	if format == "jpeg" {
		out = applyOrientation(out, jpegOrientation(data))
	}

	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return "", err
	}
	tmp, err := os.CreateTemp(filepath.Dir(dst), ".tmp-*")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name())
	if format == "png" || format == "gif" {
		err = png.Encode(tmp, out) // сохраняем прозрачность
	} else {
		err = jpeg.Encode(tmp, out, &jpeg.Options{Quality: 82})
	}
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return "", err
	}
	if err := os.Rename(tmp.Name(), dst); err != nil {
		return "", err
	}
	return dst, nil
}

// downscale — уменьшение усреднением по площади (без внешних библиотек, без «лесенки»).
func downscale(src image.Image, w, h int) image.Image {
	if w < 1 {
		w = 1
	}
	if h < 1 {
		h = 1
	}
	b := src.Bounds()
	rgba := image.NewNRGBA(b)
	draw.Draw(rgba, b, src, b.Min, draw.Src)
	sw, sh := b.Dx(), b.Dy()
	dst := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		y0 := y * sh / h
		y1 := (y + 1) * sh / h
		if y1 <= y0 {
			y1 = y0 + 1
		}
		for x := 0; x < w; x++ {
			x0 := x * sw / w
			x1 := (x + 1) * sw / w
			if x1 <= x0 {
				x1 = x0 + 1
			}
			var r, g, bl, a, n uint64
			for yy := y0; yy < y1; yy++ {
				off := yy*rgba.Stride + x0*4
				for xx := x0; xx < x1; xx++ {
					r += uint64(rgba.Pix[off])
					g += uint64(rgba.Pix[off+1])
					bl += uint64(rgba.Pix[off+2])
					a += uint64(rgba.Pix[off+3])
					off += 4
					n++
				}
			}
			i := y*dst.Stride + x*4
			dst.Pix[i] = uint8(r / n)
			dst.Pix[i+1] = uint8(g / n)
			dst.Pix[i+2] = uint8(bl / n)
			dst.Pix[i+3] = uint8(a / n)
		}
	}
	return dst
}

// jpegOrientation читает тег Orientation из EXIF (1 — как есть). Фото с телефона
// часто хранятся «боком» с этим тегом; стандартный декодер его не применяет.
func jpegOrientation(data []byte) int {
	if len(data) < 4 || data[0] != 0xFF || data[1] != 0xD8 {
		return 1
	}
	i := 2
	for i+4 <= len(data) {
		if data[i] != 0xFF {
			return 1
		}
		marker := data[i+1]
		size := int(binary.BigEndian.Uint16(data[i+2 : i+4]))
		if marker == 0xDA || size < 2 || i+2+size > len(data) {
			return 1
		}
		seg := data[i+4 : i+2+size]
		if marker == 0xE1 && len(seg) > 14 && string(seg[:6]) == "Exif\x00\x00" {
			t := seg[6:]
			var bo binary.ByteOrder
			switch string(t[:2]) {
			case "II":
				bo = binary.LittleEndian
			case "MM":
				bo = binary.BigEndian
			default:
				return 1
			}
			ifd := int(bo.Uint32(t[4:8]))
			if ifd+2 > len(t) {
				return 1
			}
			n := int(bo.Uint16(t[ifd : ifd+2]))
			for k := 0; k < n; k++ {
				e := ifd + 2 + k*12
				if e+12 > len(t) {
					return 1
				}
				if bo.Uint16(t[e:e+2]) == 0x0112 {
					v := int(bo.Uint16(t[e+8 : e+10]))
					if v >= 1 && v <= 8 {
						return v
					}
					return 1
				}
			}
			return 1
		}
		i += 2 + size
	}
	return 1
}

// applyOrientation поворачивает/отражает картинку по тегу EXIF.
func applyOrientation(src image.Image, o int) image.Image {
	if o <= 1 || o > 8 {
		return src
	}
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	swap := o >= 5
	dw, dh := w, h
	if swap {
		dw, dh = h, w
	}
	dst := image.NewNRGBA(image.Rect(0, 0, dw, dh))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			var dx, dy int
			switch o {
			case 2:
				dx, dy = w-1-x, y
			case 3:
				dx, dy = w-1-x, h-1-y
			case 4:
				dx, dy = x, h-1-y
			case 5:
				dx, dy = y, x
			case 6:
				dx, dy = h-1-y, x
			case 7:
				dx, dy = h-1-y, w-1-x
			case 8:
				dx, dy = y, w-1-x
			}
			dst.Set(dx, dy, color.NRGBAModel.Convert(src.At(b.Min.X+x, b.Min.Y+y)))
		}
	}
	return dst
}

// Регистрируем декодеры форматов, которые принимает загрузка (webp — отдаём оригинал).
var _ = gif.Decode
