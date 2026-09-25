/**
 * Сжатие фото перед загрузкой. Снимок с телефона весит 3–10 МБ и грузился
 * по мобильной сети десятки секунд; модератору хватает 1600 px по длинной
 * стороне — это 200–500 КБ. Если браузер не смог прочитать файл (редкий
 * формат), отдаём исходник как есть.
 */
const loadBitmap = async (file) => {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* ниже — запасной путь через <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const compressImage = async (file, { max = 1600, quality = 0.82 } = {}) => {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const src = await loadBitmap(file);
    const w = src.width;
    const h = src.height;
    const k = Math.min(1, max / Math.max(w, h));
    if (k === 1 && file.size < 600 * 1024) return file; // и так маленький
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * k);
    canvas.height = Math.round(h * k);
    canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height);
    src.close?.();
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
};
