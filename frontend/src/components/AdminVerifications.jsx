import React, { useState, useEffect } from 'react';
import api from '../api/client';

const AdminVerifications = () => {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVerifications = async () => {
    try {
      const res = await api.get('/admin/verifications');
      setVerifications(res.data || []);
    } catch (err) {
      console.error('Failed to load verifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/admin/verifications/${id}`, { status });
      fetchVerifications();
    } catch (err) {
      alert('Ошибка обновления статуса');
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Верификации студентов</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Пользователь</th>
            <th className="p-2 text-left">Метод</th>
            <th className="p-2 text-left">Статус</th>
            <th className="p-2 text-left">Действия</th>
          </tr>
        </thead>
        <tbody>
          {verifications.map(v => (
            <tr key={v.id} className="border-b">
              <td className="p-2">{v.id}</td>
              <td className="p-2">{v.user_id}</td>
              <td className="p-2">{v.method}</td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-white ${
                  v.status.toLowerCase() === 'pending' ? 'bg-yellow-500' :
                  v.status.toLowerCase() === 'verified' ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {v.status}
                </span>
              </td>
              <td className="p-2 space-x-2">
                {v.status.toLowerCase() === 'pending' && (
                  <>
                    <button
                      onClick={() => updateStatus(v.id, 'verified')}
                      className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                    >
                      Подтвердить
                    </button>
                    <button
                      onClick={() => updateStatus(v.id, 'rejected')}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      Отклонить
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminVerifications;
