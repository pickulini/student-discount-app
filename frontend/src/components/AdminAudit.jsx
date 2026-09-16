import React, { useState, useEffect } from 'react';
import api from '../api/client';

const AdminAudit = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/audit-logs?limit=100')
      .then(res => setLogs(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Журнал действий</h2>
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Дата</th>
              <th className="p-2 text-left">Actor ID</th>
              <th className="p-2 text-left">Действие</th>
              <th className="p-2 text-left">Тип</th>
              <th className="p-2 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan="6" className="p-4 text-center text-gray-500">Нет записей</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{log.id}</td>
                  <td className="p-2">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="p-2">{log.actor_id || '—'}</td>
                  <td className="p-2 font-mono text-xs">{log.action}</td>
                  <td className="p-2">{log.entity_type}</td>
                  <td className="p-2 text-xs">{log.ip || '—'}</td>
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
