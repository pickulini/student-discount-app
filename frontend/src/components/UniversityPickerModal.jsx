import React, { useState } from 'react';
import api from '../api/client';

const UniversityPickerModal = ({ userId, currentUniversityId, universities, onClose, onSaved }) => {
  const [selected, setSelected] = useState(currentUniversityId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const universityId = selected === '' ? null : parseInt(selected);
      await api.patch(`/admin/users/${userId}/university`, {
        university_id: universityId,
      });
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold">Присвоить вуз</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
              ✕
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Пользователь ID: <strong>#{userId}</strong>
          </p>

          {error && <div className="bg-red-50 text-red-700 p-2 rounded mb-3 text-sm">{error}</div>}

          <div className="mb-4">
            <label className="block text-sm mb-1">Университет</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full border p-2 rounded"
            >
              <option value="">— Не присвоен —</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.short_name || u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversityPickerModal;
