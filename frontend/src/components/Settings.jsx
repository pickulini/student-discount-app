import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../design/UI';

const TILES = [
  { to: '/settings/profile', icon: '👤', title: 'Профиль', hint: 'Никнейм, username, аватар' },
  { to: '/settings/privacy', icon: '🔒', title: 'Приватность', hint: 'Кто видит ваш профиль' },
  { to: '/settings/notifications', icon: '🔔', title: 'Уведомления', hint: 'Что вам присылать' },
  { to: '/settings/verification', icon: '🎓', title: 'Верификация', hint: 'Статус студента' },
  { to: '/settings/security', icon: '🔑', title: 'Безопасность', hint: 'Пароль и активные сессии' },
  { to: '/settings/account', icon: '📊', title: 'Аккаунт', hint: 'Баланс, рефералы, удаление' },
];

const Settings = () => {
  const { user } = useAuth();
  if (!user) return null;

  const displayName = user.nickname || user.full_name;

  return (
    <div>
      <Card className="p-5 mb-4 flex items-center gap-4">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-surface-2 border border-line flex items-center justify-center text-accent text-xl font-bold">
            {displayName?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold text-ink truncate">{displayName}</div>
          {user.username && <div className="text-accent text-sm">@{user.username}</div>}
          <div className="text-xs text-ink-faint">{user.email}</div>
        </div>
        <Link to={`/@${user.username}`} className="text-sm text-accent hover:underline self-start">
          Мой профиль →
        </Link>
      </Card>

      <h2 className="text-lg font-semibold text-ink mb-3">Что можно настроить</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TILES.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="bg-surface border border-line rounded-[var(--radius-md)] p-4 hover:border-ink-faint transition flex items-center gap-3"
          >
            <span className="text-2xl">{t.icon}</span>
            <div>
              <div className="font-semibold text-ink">{t.title}</div>
              <div className="text-xs text-ink-faint">{t.hint}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Settings;
