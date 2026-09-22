import React from 'react';
import { Link, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RouteMark } from '../design/DottedPath';

const MerchantLayout = () => {
  const { user, isAdmin } = useAuth();

  // Доступ только для партнёров (role == merchant)
  if (!user || user.role !== 'merchant') {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-bg flex text-ink">
      <aside className="w-64 flex-shrink-0 border-r border-line p-4">
        <Link to="/" className="flex items-center gap-2.5 mb-6 group">
          <RouteMark />
          <span className="text-sm font-semibold tracking-wide text-ink group-hover:text-accent transition">
            Партнёрский кабинет
          </span>
        </Link>
        <nav className="space-y-1 text-sm">
          <Link to="/merchant" className="block px-3 py-2 rounded-[var(--radius-xs)] hover:bg-surface-2 text-ink-soft hover:text-ink transition">Дашборд</Link>
          <Link to="/merchant/offers" className="block px-3 py-2 rounded-[var(--radius-xs)] hover:bg-surface-2 text-ink-soft hover:text-ink transition">Мои предложения</Link>
          <Link to="/events/new" className="block px-3 py-2 rounded-[var(--radius-xs)] hover:bg-surface-2 text-ink-soft hover:text-ink transition">Создать ивент</Link>
          <Link to="/merchant/events" className="block px-3 py-2 rounded-[var(--radius-xs)] hover:bg-surface-2 text-ink-soft hover:text-ink transition">Мои ивенты</Link>
          <Link to="/merchant/companies" className="block px-3 py-2 rounded-[var(--radius-xs)] hover:bg-surface-2 text-ink-soft hover:text-ink transition">Мои компании</Link>
          <Link to="/merchant/statistics" className="block px-3 py-2 rounded-[var(--radius-xs)] hover:bg-surface-2 text-ink-soft hover:text-ink transition">Статистика</Link>
          <div className="border-t border-line my-2" />
          <Link to="/" className="block px-3 py-2 rounded-[var(--radius-xs)] hover:bg-surface-2 text-accent transition">← На сайт</Link>
        </nav>
      </aside>
      <div className="flex-1 p-6">
        <Outlet />
      </div>
    </div>
  );
};

export default MerchantLayout;
