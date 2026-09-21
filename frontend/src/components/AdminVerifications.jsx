import React, { useState, useEffect } from 'react';
import api from '../api/client';
import AdminVerificationDetailModal from './AdminVerificationDetailModal';

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

  if (loading) return <div>Загрузка...</div>;

  const filtered = filterStatus === 'all'
    ? verifications
    : verifications.filter((v) => v.status === filterStatus);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Верификации</h2>

      <div className="mb-4 flex gap-2">
        <label className="text-sm">Фильтр:</label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded p-1 text-sm"
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
            <tr className="bg-gray-100">
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Пользователь</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Студенческий</th>
              <th className="p-2 text-left">Статус</th>
              <th className="p-2 text-left">Фото</th>
              <th className="p-2 text-left">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const displayName = v.user_nickname || v.user_full_name || `#${v.user_id}`;
              const hasPhotos = v.document_key || v.selfie_key;
              return (
                <tr key={v.id} className="border-b">
                  <td className="p-2">{v.id}</td>
                  <td className="p-2">
                    {v.user_username ? (
                      <span>
                        <span className="font-semibold">{displayName}</span>
                        <span className="text-blue-600 ml-1 text-xs">@{v.user_username}</span>
                      </span>
                    ) : (
                      displayName
                    )}
                  </td>
                  <td className="p-2 text-xs text-gray-600">{v.user_email || '—'}</td>
                  <td className="p-2 text-xs">{v.student_identifier || '—'}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-1 rounded text-white text-xs ${
                        v.status === 'pending' ? 'bg-yellow-500' :
                        v.status === 'verified' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <span
                        title="Студенческий"
                        className={`text-xs px-2 py-1 rounded ${v.document_key ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'}`}
                      >
                        📄 {v.document_key ? '✓' : '—'}
                      </span>
                      <span
                        title="Селфи"
                        className={`text-xs px-2 py-1 rounded ${v.selfie_key ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'}`}
                      >
                        🤳 {v.selfie_key ? '✓' : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => setSelected(v)}
                      className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs"
                    >
                      Открыть
                    </button>
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
