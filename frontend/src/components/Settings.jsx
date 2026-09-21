import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
  const { user } = useAuth();
  if (!user) return null;

  const displayName = user.nickname || user.full_name;

  return (
    <div>
      <div className="bg-white rounded-2xl shadow p-5 mb-4 flex items-center gap-4">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold">
            {displayName?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold truncate">{displayName}</div>
          {user.username && <div className="text-blue-600 text-sm">@{user.username}</div>}
          <div className="text-xs text-gray-500">{user.email}</div>
        </div>
        <Link
          to={`/@${user.username}`}
          className="text-sm text-blue-600 hover:underline self-start"
        >
          Мой профиль →
        </Link>
      </div>

      <h2 className="text-lg font-semibold mb-3">Что можно настроить</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link to="/settings/profile" className="bg-white rounded-xl shadow p-4 hover:shadow-md transition flex items-center gap-3">
          <span className="text-2xl">👤</span>
          <div>
            <div className="font-semibold">Профиль</div>
            <div className="text-xs text-gray-500">Никнейм, username, аватар</div>
          </div>
        </Link>
        <Link to="/settings/privacy" className="bg-white rounded-xl shadow p-4 hover:shadow-md transition flex items-center gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <div className="font-semibold">Приватность</div>
            <div className="text-xs text-gray-500">Кто видит ваш профиль</div>
          </div>
        </Link>
        <Link to="/settings/notifications" className="bg-white rounded-xl shadow p-4 hover:shadow-md transition flex items-center gap-3">
          <span className="text-2xl">🔔</span>
          <div>
            <div className="font-semibold">Уведомления</div>
            <div className="text-xs text-gray-500">Что вам присылать</div>
          </div>
        </Link>
        <Link to="/settings/verification" className="bg-white rounded-xl shadow p-4 hover:shadow-md transition flex items-center gap-3">
          <span className="text-2xl">🎓</span>
          <div>
            <div className="font-semibold">Верификация</div>
            <div className="text-xs text-gray-500">Статус студента</div>
          </div>
        </Link>
        <Link to="/settings/security" className="bg-white rounded-xl shadow p-4 hover:shadow-md transition flex items-center gap-3">
          <span className="text-2xl">🔑</span>
          <div>
            <div className="font-semibold">Безопасность</div>
            <div className="text-xs text-gray-500">Пароль и активные сессии</div>
          </div>
        </Link>
        <Link to="/settings/account" className="bg-white rounded-xl shadow p-4 hover:shadow-md transition flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <div className="font-semibold">Аккаунт</div>
            <div className="text-xs text-gray-500">Баланс, рефералы, удаление</div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Settings;
