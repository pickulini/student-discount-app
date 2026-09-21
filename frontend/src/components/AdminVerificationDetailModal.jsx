import React, { useState } from 'react';
import api from '../api/client';

const AdminVerificationDetailModal = ({ verification, onClose, onUpdate }) => {
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState('');

  const handleAction = async (status) => {
    if (status === 'rejected' && !reason.trim()) {
      setError('Укажите причину отклонения');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.put(`/admin/verifications/${verification.id}`, {
        status,
        rejection_reason: status === 'rejected' ? reason : '',
      });
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const v = verification;
  const displayName = v.user_nickname || v.user_full_name || `#${v.user_id}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold">Верификация #{v.id}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {displayName}
                {v.user_username && (
                  <span className="text-blue-600 ml-2">@{v.user_username}</span>
                )}
              </p>
              {v.user_email && (
                <p className="text-xs text-gray-500">{v.user_email}</p>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="bg-gray-50 p-2 rounded">
              <span className="text-gray-500">Номер студенческого:</span>
              <div className="font-semibold">{v.student_identifier || '—'}</div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <span className="text-gray-500">Вуз:</span>
              <div className="font-semibold">
                {v.university_name || (v.university_id ? `ID ${v.university_id}` : '—')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="font-semibold text-sm mb-2">📄 Студенческий</h3>
              {v.document_key ? (
                <a href={v.document_key} target="_blank" rel="noopener noreferrer">
                  <img
                    src={v.document_key}
                    alt="Студенческий"
                    className="w-full rounded border hover:opacity-90 cursor-pointer"
                    style={{ maxHeight: '400px', objectFit: 'contain' }}
                  />
                </a>
              ) : (
                <div className="text-gray-400 text-sm py-8 text-center border rounded">
                  Не загружено
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">🤳 Селфи</h3>
              {v.selfie_key ? (
                <a href={v.selfie_key} target="_blank" rel="noopener noreferrer">
                  <img
                    src={v.selfie_key}
                    alt="Селфи"
                    className="w-full rounded border hover:opacity-90 cursor-pointer"
                    style={{ maxHeight: '400px', objectFit: 'contain' }}
                  />
                </a>
              ) : (
                <div className="text-gray-400 text-sm py-8 text-center border rounded">
                  Не загружено
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-2 rounded mb-3 text-sm">{error}</div>
          )}

          {showReject && (
            <div className="mb-3">
              <label className="block text-sm mb-1">Причина отклонения</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border p-2 rounded"
                rows="2"
                placeholder="Что не так с фото или данными?"
              />
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {!showReject ? (
              <>
                <button
                  onClick={() => handleAction('verified')}
                  disabled={saving}
                  className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  ✓ Подтвердить
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  disabled={saving}
                  className="flex-1 bg-red-500 text-white py-2 rounded hover:bg-red-600 disabled:opacity-50"
                >
                  ✕ Отклонить
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleAction('rejected')}
                  disabled={saving}
                  className="flex-1 bg-red-500 text-white py-2 rounded hover:bg-red-600 disabled:opacity-50"
                >
                  {saving ? 'Отправка...' : 'Отправить отказ'}
                </button>
                <button
                  onClick={() => { setShowReject(false); setReason(''); }}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Отмена
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminVerificationDetailModal;
