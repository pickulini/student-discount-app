import React, { useState, useEffect } from 'react';
import api from '../api/client';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/statistics')
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Статистика</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Пользователи</p>
          <p className="text-3xl font-bold">{stats?.total_users || 0}</p>
        </div>
        <div className="bg-green-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Компании</p>
          <p className="text-3xl font-bold">{stats?.total_companies || 0}</p>
        </div>
        <div className="bg-purple-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Предложения</p>
          <p className="text-3xl font-bold">{stats?.total_offers || 0}</p>
        </div>
        <div className="bg-yellow-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Заказы</p>
          <p className="text-3xl font-bold">{stats?.total_orders || 0}</p>
        </div>
        <div className="bg-red-100 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Выручка</p>
          <p className="text-3xl font-bold">{stats?.total_revenue || 0} ₽</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
