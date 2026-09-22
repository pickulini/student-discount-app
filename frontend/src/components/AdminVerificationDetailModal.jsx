import React, { useState } from 'react';
import api from '../api/client';
import { Button, Textarea, Label, Eyebrow, ErrorText } from '../design/UI';

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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-surface border border-line rounded-[var(--radius-lg)] max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-editorial text-2xl text-ink uppercase">Верификация #{v.id}</h2>
              <p className="text-sm text-ink-soft mt-1">
                {displayName}
                {v.user_username && (
                  <span className="text-accent ml-2">@{v.user_username}</span>
                )}
              </p>
              {v.user_email && (
                <p className="text-xs text-ink-faint">{v.user_email}</p>
              )}
            </div>
            <button onClick={onClose} className="text-ink-faint hover:text-ink text-2xl leading-none">
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="bg-surface-2 border border-line p-2 rounded-[var(--radius-sm)]">
              <span className="text-ink-faint">Номер студенческого:</span>
              <div className="font-semibold text-ink">{v.student_identifier || '—'}</div>
            </div>
            <div className="bg-surface-2 border border-line p-2 rounded-[var(--radius-sm)]">
              <span className="text-ink-faint">Вуз:</span>
              <div className="font-semibold text-ink">
                {v.university_name || (v.university_id ? `ID ${v.university_id}` : '—')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Eyebrow className="mb-2">Студенческий</Eyebrow>
              {v.document_key ? (
                <a href={v.document_key} target="_blank" rel="noopener noreferrer">
                  <img
                    src={v.document_key}
                    alt="Студенческий"
                    className="w-full rounded-[var(--radius-sm)] border border-line hover:opacity-90 cursor-pointer"
                    style={{ maxHeight: '400px', objectFit: 'contain' }}
                  />
                </a>
              ) : (
                <div className="text-ink-faint text-sm py-8 text-center border border-line rounded-[var(--radius-sm)]">
                  Не загружено
                </div>
              )}
            </div>
            <div>
              <Eyebrow className="mb-2">Селфи</Eyebrow>
              {v.selfie_key ? (
                <a href={v.selfie_key} target="_blank" rel="noopener noreferrer">
                  <img
                    src={v.selfie_key}
                    alt="Селфи"
                    className="w-full rounded-[var(--radius-sm)] border border-line hover:opacity-90 cursor-pointer"
                    style={{ maxHeight: '400px', objectFit: 'contain' }}
                  />
                </a>
              ) : (
                <div className="text-ink-faint text-sm py-8 text-center border border-line rounded-[var(--radius-sm)]">
                  Не загружено
                </div>
              )}
            </div>
          </div>

          <ErrorText>{error}</ErrorText>

          {showReject && (
            <div className="mb-3">
              <Label className="mb-1">Причина отклонения</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows="2"
                placeholder="Что не так с фото или данными?"
              />
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {!showReject ? (
              <>
                <Button onClick={() => handleAction('verified')} disabled={saving} className="flex-1">
                  Подтвердить
                </Button>
                <Button variant="danger" onClick={() => setShowReject(true)} disabled={saving} className="flex-1">
                  Отклонить
                </Button>
              </>
            ) : (
              <>
                <Button variant="danger" onClick={() => handleAction('rejected')} disabled={saving} className="flex-1">
                  {saving ? 'Отправка...' : 'Отправить отказ'}
                </Button>
                <Button variant="ghost" onClick={() => { setShowReject(false); setReason(''); }}>
                  Отмена
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminVerificationDetailModal;
