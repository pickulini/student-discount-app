import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/settings', label: 'Общее', icon: '⚙️', exact: true },
  { to: '/settings/profile', label: 'Профиль', icon: '👤' },
  { to: '/settings/privacy', label: 'Приватность', icon: '🔒' },
  { to: '/settings/notifications', label: 'Уведомления', icon: '🔔' },
  { to: '/settings/verification', label: 'Верификация', icon: '🎓' },
  { to: '/settings/security', label: 'Безопасность', icon: '🔑' },
  { to: '/settings/account', label: 'Аккаунт', icon: '📊' },
];

const SettingsLayout = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <div className="text-center py-8 text-ink-soft">Требуется авторизация</div>;
  }

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar / top-tabs */}
        <aside className="md:w-64 flex-shrink-0">
          <h1 className="text-2xl font-semibold text-ink mb-4">Настройки</h1>
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {NAV.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] whitespace-nowrap transition ${
                    active
                      ? 'bg-surface-2 text-accent font-semibold'
                      : 'text-ink-soft hover:bg-surface-2 hover:text-ink'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="text-sm">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SettingsLayout;
