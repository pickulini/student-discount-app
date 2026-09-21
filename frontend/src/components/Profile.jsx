import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import UserLink from './UserLink';

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

  if (loading) return <div className="text-center py-8">Загрузка...</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;
  if (!data) return null;

  const displayName = data.nickname || data.full_name;
  const isVerified = data.student_status === 'verified';

  return (
    <div className="max-w-lg mx-auto bg-white p-6 rounded-2xl shadow">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-bold">Мой профиль</h2>
        <Link
          to="/settings/profile"
          className="text-sm text-blue-600 hover:underline"
        >
          Настроить →
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-6">
        {data.avatar_url ? (
          <img
            src={data.avatar_url}
            alt="Аватар"
            className="w-20 h-20 rounded-full object-cover border-2 border-blue-200"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
            {displayName?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xl font-semibold truncate">{displayName}</p>
          {data.username && (
            <p className="text-sm">
              <UserLink username={data.username} />
            </p>
          )}
          <p className="text-gray-500 text-sm truncate">{data.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-blue-50 p-3 rounded-xl text-center">
          <div className="text-2xl font-bold text-blue-700">{data.balance || 0} ₽</div>
          <div className="text-xs text-gray-600">Баланс</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-xl text-center">
          <div className="text-2xl font-bold text-yellow-700">{data.bonus_balance || 0}</div>
          <div className="text-xs text-gray-600">Бонусы</div>
        </div>
      </div>

      <div className="space-y-2 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Статус студента</span>
          <span className={`px-2 py-0.5 rounded text-white text-xs ${
            isVerified ? 'bg-green-500' :
            data.student_status === 'pending' ? 'bg-yellow-500' :
            data.student_status === 'expired' ? 'bg-orange-500' : 'bg-red-500'
          }`}>
            {data.student_status}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Реферальный код</span>
          <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{data.referral_code}</code>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">На платформе с</span>
          <span>{new Date(data.created_at).toLocaleDateString('ru-RU')}</span>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t flex flex-wrap gap-2">
        <Link
          to="/settings/verification"
          className={`flex-1 text-center px-4 py-2 rounded ${
            isVerified
              ? 'bg-green-50 text-green-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isVerified ? '✓ Верифицирован' : 'Пройти верификацию'}
        </Link>
        <Link
          to="/settings"
          className="flex-1 text-center px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
        >
          Все настройки
        </Link>
      </div>
    </div>
  );
};

export default Profile;
