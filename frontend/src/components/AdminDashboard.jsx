import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { Card, PageTitle, Eyebrow } from '../design/UI';
import { RouteLoadingView, RouteErrorState } from '../design/DottedPath';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/statistics')
      .then(res => {
        setStats(res.data);
      })
      .catch(err => {
        console.error('Failed to load statistics:', err);
        setError('Не удалось загрузить статистику');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <RouteLoadingView label="Загрузка статистики..." />;
  if (error) return <RouteErrorState message={error} />;

  const tiles = [
    { label: 'Пользователи', value: stats?.total_users || 0 },
    { label: 'Компании', value: stats?.total_companies || 0 },
    { label: 'Предложения', value: stats?.total_offers || 0 },
    { label: 'Заказы', value: stats?.total_orders || 0 },
    { label: 'Выручка', value: `${stats?.total_revenue || 0} ₽` },
  ];

  return (
    <div>
      <PageTitle>Статистика</PageTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <Eyebrow>{tile.label}</Eyebrow>
            <div className="text-editorial text-3xl text-ink mt-1">{tile.value}</div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
