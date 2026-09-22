import React, { useState } from 'react';
import api from '../api/client';
import { Label } from '../design/UI';

const ImageUpload = ({ value, onChange, uploadEndpoint = '/merchant/upload' }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Файл больше 5 МБ');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Явно НЕ устанавливаем Content-Type — axios подставит boundary автоматически
      const res = await api.post(uploadEndpoint, formData);
      onChange(res.data.url);
    } catch (err) {
      console.error('Upload error:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const imageSrc = value
    ? (value.startsWith('http') ? value : value)
    : null;

  return (
    <div>
      <Label className="mb-1">Фото (фон карточки / аватар)</Label>
      {imageSrc ? (
        <div className="relative inline-block">
          <img
            src={imageSrc}
            alt="Обложка"
            className="w-48 h-32 object-cover rounded-[var(--radius-sm)] border border-line"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-2 -right-2 bg-danger text-white rounded-full w-6 h-6 text-xs"
          >
            ✕
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center w-48 h-32 border-2 border-dashed border-line rounded-[var(--radius-sm)] cursor-pointer hover:border-accent transition">
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
            disabled={uploading}
          />
          <span className="text-sm text-ink-soft">
            {uploading ? 'Загрузка...' : '📷 Загрузить'}
          </span>
        </label>
      )}
      {error && <p className="text-danger text-xs mt-1">{error}</p>}
    </div>
  );
};

export default ImageUpload;
