import React, { useState, useEffect } from 'react';
import api from '../api/client';
import ImageUpload from './ImageUpload';

const VerificationModal = ({ onClose, onSuccess }) => {
  const [universities, setUniversities] = useState([]);
  const [universityId, setUniversityId] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [documentKey, setDocumentKey] = useState('');
  const [selfieKey, setSelfieKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/universities')
      .then((res) => setUniversities(res.data || []))
      .catch(() => setUniversities([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!documentKey) {
      setError('Приложите фото студенческого билета');
      return;
    }
    if (!selfieKey) {
      setError('Приложите селфи со студенческим в руках');
      return;
    }
    if (!universityName.trim()) {
      setError('Укажите университет');
      return;
    }
    if (!studentIdentifier.trim()) {
      setError('Укажите номер студенческого');
      return;
    }

    setSaving(true);
    try {
      await api.post('/students/verify', {
        university_id: universityId ? parseInt(universityId) : null,
        university_name: !universityId ? universityName.trim() : '',
        student_identifier: studentIdentifier.trim(),
        document_key: documentKey,
        selfie_key: selfieKey,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка отправки');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold">Верификация студента</h2>
              <p className="text-sm text-gray-500 mt-1">
                Заполните данные и приложите фото. Админ проверит в течение 1-2 дней.
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
              ✕
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Университет *</label>
              <input
                type="text"
                list="universities-list"
                value={universityName}
                onChange={(e) => {
                  const val = e.target.value;
                  setUniversityName(val);
                  // пробуем сопоставить с существующим
                  const match = universities.find(
                    (u) => (u.short_name || u.name).toLowerCase() === val.toLowerCase()
                      || u.name.toLowerCase() === val.toLowerCase()
                  );
                  setUniversityId(match ? String(match.id) : '');
                }}
                className="w-full border p-2 rounded"
                placeholder="Начните вводить название — появятся подсказки"
                required
              />
              <datalist id="universities-list">
                {universities.map((u) => (
                  <option key={u.id} value={u.short_name || u.name}>
                    {u.name}
                  </option>
                ))}
              </datalist>
              {universityName && !universityId && (
                <p className="text-xs text-blue-600 mt-1">
                  Новый вуз — будет создан после проверки админом
                </p>
              )}
              {universityId && (
                <p className="text-xs text-green-600 mt-1">
                  Из списка: {universities.find((u) => String(u.id) === String(universityId))?.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm mb-1">Номер студенческого *</label>
              <input
                type="text"
                value={studentIdentifier}
                onChange={(e) => setStudentIdentifier(e.target.value)}
                className="w-full border p-2 rounded"
                placeholder="Например: 12345/2024"
                maxLength={50}
                required
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm mb-2">1. Фото студенческого билета</h3>
              <p className="text-xs text-gray-500 mb-2">
                Разворот с фотографией и номером. Убедитесь, что все данные читаемы.
              </p>
              <ImageUpload
                value={documentKey}
                onChange={(url) => setDocumentKey(url || '')}
                uploadEndpoint="/users/upload-avatar"
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm mb-2">2. Селфи со студенческим в руках</h3>
              <p className="text-xs text-gray-500 mb-2">
                Сфотографируйте себя, держа открытый студенческий рядом с лицом.
              </p>
              <ImageUpload
                value={selfieKey}
                onChange={(url) => setSelfieKey(url || '')}
                uploadEndpoint="/users/upload-avatar"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Отправка...' : 'Отправить на проверку'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VerificationModal;
