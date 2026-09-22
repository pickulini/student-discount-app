import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { PageTitle, Caption } from '../design/UI';
import { RouteLoadingView, RouteEmptyState } from '../design/DottedPath';

const AdminAudit = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/audit-logs?limit=100')
      .then(res => setLogs(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <RouteLoadingView label="Загрузка журнала..." />;

  return (
    <div>
      <PageTitle>Журнал действий</PageTitle>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">ID</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Дата</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Actor ID</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Действие</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">Тип</th>
              <th className="p-2 text-left text-eyebrow text-ink-faint font-normal">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan="6" className="p-0"><RouteEmptyState title="Нет записей" /></td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="border-b border-line hover:bg-surface-2">
                  <td className="p-2 text-ink-faint">{log.id}</td>
                  <td className="p-2"><Caption>{new Date(log.created_at).toLocaleString()}</Caption></td>
                  <td className="p-2 text-ink-soft">{log.actor_id || '—'}</td>
                  <td className="p-2 font-mono text-xs text-ink">{log.action}</td>
                  <td className="p-2 text-ink-soft">{log.entity_type}</td>
                  <td className="p-2 text-xs text-ink-faint">{log.ip || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminAudit;
