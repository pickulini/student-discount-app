import React, { useState, useEffect } from 'react';
import api from '../api/client';
import VerificationModal from './VerificationModal';
import { Card, Button } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

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

  if (loading) return <RouteLoadingView label="Загрузка..." />;
  if (error) return <div className="text-danger">{error}</div>;
  if (!data) return null;

  const status = data.student_status || 'pending';
  const statusLabels = {
    pending: { label: 'Не верифицирован', color: 'bg-ink-faint', hint: 'Загрузите документы для проверки' },
    verified: { label: 'Верифицирован', color: 'bg-accent', hint: 'Все скидки доступны' },
    expired: { label: 'Верификация истекла', color: 'bg-ink-faint', hint: 'Загрузите документы снова' },
    rejected: { label: 'Отклонена', color: 'bg-danger', hint: 'Загрузите корректные документы' },
  };
  const meta = statusLabels[status] || statusLabels.pending;

  return (
    <Card className="p-6">
      <h2 className="text-editorial text-xl text-ink uppercase mb-1">Верификация студента</h2>
      <p className="text-sm text-ink-soft mb-4">
        Верифицированные студенты получают доступ ко всем скидкам и ивентам
      </p>

      <div className="flex items-center gap-3 p-4 rounded-[var(--radius-sm)] bg-surface-2 mb-4">
        <span className={`w-3 h-3 rounded-full ${meta.color}`} />
        <div>
          <div className="font-semibold text-ink">{meta.label}</div>
          <div className="text-xs text-ink-faint">{meta.hint}</div>
        </div>
      </div>

      {status === 'verified' && data.student_verification_expires_at && (
        <div className="text-sm text-ink-soft mb-4">
          Действует до:{' '}
          <strong className="text-ink">{new Date(data.student_verification_expires_at).toLocaleDateString('ru-RU')}</strong>
        </div>
      )}

      {status === 'pending' && (
        <Button onClick={() => setShowModal(true)} className="w-full">
          Отправить заявку на верификацию
        </Button>
      )}

      {(status === 'rejected' || status === 'expired') && (
        <Button onClick={() => setShowModal(true)} className="w-full">
          Отправить заявку повторно
        </Button>
      )}

      {showModal && (
        <VerificationModal
          onClose={() => setShowModal(false)}
          onSuccess={() => setReloadKey((k) => k + 1)}
        />
      )}
    </Card>
  );
};

export default SettingsVerification;
