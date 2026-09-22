import React, { useState, useEffect } from 'react';
import api from '../api/client';
import AdminVerificationDetailModal from './AdminVerificationDetailModal';
import { PageTitle, Button, Badge } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

const STATUS_LABELS = {
  pending: 'Ожидает',
  verified: 'Подтверждён',
  rejected: 'Отклонён',
};

const AdminVerifications = () => {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null);

  const fetchVerifications = async () => {
    try {
      const res = await api.get('/admin/verifications');
      setVerifications(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, []);

  const handleUpdate = () => {
    fetchVerifications();
  };

  if (loading) return <RouteLoadingView label="Загрузка верификаций..." />;

  const filtered = filterStatus === 'all'
    ? verifications
    : verifications.filter((v) => v.status === filterStatus);

  return (
    <div>
      <PageTitle>Верификации</PageTitle>

      <div className="mb-4 flex gap-2 items-center">
        <label className="text-sm text-ink-soft">Фильтр:</label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-surface border border-line rounded-[var(--radius-xs)] p-1.5 text-sm text-ink"
        >
          <option value="all">Все</option>
          <option value="pending">Ожидают</option>
          <option value="verified">Подтверждённые</option>
          <option value="rejected">Отклонённые</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">ID</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Пользователь</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Email</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Студенческий</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Статус</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Фото</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const displayName = v.user_nickname || v.user_full_name || `#${v.user_id}`;
              return (
                <tr key={v.id} className="border-b border-line">
                  <td className="p-2 text-ink-faint">{v.id}</td>
                  <td className="p-2">
                    {v.user_username ? (
                      <span>
                        <span className="font-medium text-ink">{displayName}</span>
                        <span className="text-accent ml-1 text-xs">@{v.user_username}</span>
                      </span>
                    ) : (
                      <span className="text-ink">{displayName}</span>
                    )}
                  </td>
                  <td className="p-2 text-xs text-ink-soft">{v.user_email || '—'}</td>
                  <td className="p-2 text-xs text-ink-soft">{v.student_identifier || '—'}</td>
                  <td className="p-2">
                    <Badge
                      filled={v.status === 'verified'}
                      className={v.status === 'rejected' ? '!text-danger !border-danger/30' : ''}
                    >
                      {STATUS_LABELS[v.status] || v.status}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <span
                        title="Студенческий"
                        className={`text-xs px-2 py-1 rounded-[var(--radius-xs)] border border-line ${v.document_key ? 'text-accent' : 'text-ink-faint'}`}
                      >
                        {v.document_key ? '✓' : '—'}
                      </span>
                      <span
                        title="Селфи"
                        className={`text-xs px-2 py-1 rounded-[var(--radius-xs)] border border-line ${v.selfie_key ? 'text-accent' : 'text-ink-faint'}`}
                      >
                        {v.selfie_key ? '✓' : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="p-2">
                    <Button variant="ghost" onClick={() => setSelected(v)} className="text-xs px-3 py-1">
                      Открыть
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <AdminVerificationDetailModal
          verification={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
};

export default AdminVerifications;
