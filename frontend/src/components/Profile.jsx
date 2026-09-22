import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import UserLink from './UserLink';
import { Card, Button } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

const Profile = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/me')
      .then((res) => setData(res.data))
      .catch(() => setError('Не удалось загрузить профиль'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <RouteLoadingView label="Загрузка..." />;
  if (error) return <div className="text-center py-8 text-danger">{error}</div>;
  if (!data) return null;

  const displayName = data.nickname || data.full_name;
  const isVerified = data.student_status === 'verified';

  const statusColor = isVerified
    ? 'bg-accent/10 text-accent'
    : data.student_status === 'pending'
    ? 'bg-surface-2 text-ink-soft'
    : 'bg-danger/10 text-danger';

  return (
    <Card className="max-w-lg mx-auto p-6">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-editorial text-2xl text-ink uppercase">Мой профиль</h2>
        <Link to="/settings/profile" className="text-sm text-accent hover:underline">
          Настроить →
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-6">
        {data.avatar_url ? (
          <img
            src={data.avatar_url}
            alt="Аватар"
            className="w-20 h-20 rounded-full object-cover border border-line"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-surface-2 border border-line flex items-center justify-center text-accent text-2xl font-bold">
            {displayName?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xl font-semibold text-ink truncate">{displayName}</p>
          {data.username && (
            <p className="text-sm">
              <UserLink username={data.username} />
            </p>
          )}
          <p className="text-ink-faint text-sm truncate">{data.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-surface-2 border border-line p-3 rounded-[var(--radius-sm)] text-center">
          <div className="text-editorial text-2xl text-ink">{data.balance || 0} ₽</div>
          <div className="text-eyebrow text-ink-faint mt-1">Баланс</div>
        </div>
        <div className="bg-surface-2 border border-line p-3 rounded-[var(--radius-sm)] text-center">
          <div className="text-editorial text-2xl text-accent">{data.bonus_balance || 0}</div>
          <div className="text-eyebrow text-ink-faint mt-1">Бонусы</div>
        </div>
      </div>

      <div className="space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-soft">Статус студента</span>
          <span className={`px-2 py-0.5 rounded-[var(--radius-xs)] text-xs font-medium ${statusColor}`}>
            {data.student_status}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-soft">Реферальный код</span>
          <code className="bg-surface-2 px-2 py-0.5 rounded-[var(--radius-xs)] text-xs text-ink">{data.referral_code}</code>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-soft">На платформе с</span>
          <span className="text-ink">{new Date(data.created_at).toLocaleDateString('ru-RU')}</span>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-line flex flex-wrap gap-2">
        <Link to="/settings/verification" className="flex-1">
          <Button variant={isVerified ? 'ghost' : 'primary'} className="w-full">
            {isVerified ? '✓ Верифицирован' : 'Пройти верификацию'}
          </Button>
        </Link>
        <Link to="/settings" className="flex-1">
          <Button variant="ghost" className="w-full">
            Все настройки
          </Button>
        </Link>
      </div>
    </Card>
  );
};

export default Profile;
