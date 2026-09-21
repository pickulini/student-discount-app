import React, { useState, useEffect } from 'react';
import api from '../api/client';
import VerificationModal from './VerificationModal';

const SettingsVerification = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api.get('/users/me')
      .then((res) => setData(res.data))
      .catch(() => setError('Не удалось загрузить'))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!data) return null;

  const status = data.student_status || 'pending';
  const statusLabels = {
    pending: { label: 'Не верифицирован', color: 'bg-gray-400', hint: 'Загрузите документы для проверки' },
    verified: { label: 'Верифицирован', color: 'bg-green-500', hint: 'Все скидки доступны' },
    expired: { label: 'Верификация истекла', color: 'bg-orange-500', hint: 'Загрузите документы снова' },
    rejected: { label: 'Отклонена', color: 'bg-red-500', hint: 'Загрузите корректные документы' },
  };
  const meta = statusLabels[status] || statusLabels.pending;

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-xl font-bold mb-1">Верификация студента</h2>
      <p className="text-sm text-gray-500 mb-4">
        Верифицированные студенты получают доступ ко всем скидкам и ивентам
      </p>

      <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 mb-4">
        <span className={`w-3 h-3 rounded-full ${meta.color}`} />
        <div>
          <div className="font-semibold">{meta.label}</div>
          <div className="text-xs text-gray-500">{meta.hint}</div>
        </div>
      </div>

      {status === 'verified' && data.student_verification_expires_at && (
        <div className="text-sm text-gray-600 mb-4">
          Действует до:{' '}
          <strong>{new Date(data.student_verification_expires_at).toLocaleDateString('ru-RU')}</strong>
        </div>
      )}

      {status === 'pending' && (
        <button
          onClick={() => setShowModal(true)}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Отправить заявку на верификацию
        </button>
      )}

      {(status === 'rejected' || status === 'expired') && (
        <button
          onClick={() => setShowModal(true)}
          className="w-full bg-orange-500 text-white py-2 rounded hover:bg-orange-600"
        >
          Отправить заявку повторно
        </button>
      )}

      {showModal && (
        <VerificationModal
          onClose={() => setShowModal(false)}
          onSuccess={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
};

export default SettingsVerification;
