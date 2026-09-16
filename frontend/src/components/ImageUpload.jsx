import React, { useState } from 'react';
import api from '../api/client';

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
      const res = await api.post(uploadEndpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.url);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-sm mb-1">Фото (фон карточки)</label>
      {value ? (
        <div className="relative inline-block">
          <img
            src={`http://localhost:8080${value}`}
            alt="Обложка"
            className="w-48 h-32 object-cover rounded border"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs"
          >
            ✕
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center w-48 h-32 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-400">
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
            disabled={uploading}
          />
          <span className="text-sm text-gray-500">
            {uploading ? 'Загрузка...' : '📷 Загрузить'}
          </span>
        </label>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default ImageUpload;
