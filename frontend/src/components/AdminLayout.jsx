import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../api/client';
import { Avatar, Leader, Rule, Rule2, VRule, num } from './merchant/kit';
import { shortName } from './admin/shared';

/**
 * Админ-панель — общий каркас по макету «Концепция «Чек», Админ · desktop» (A01–A10):
 * логотип и плашка «АДМИН-ПАНЕЛЬ», «● LIVE · НОВЫХ ЗАЯВОК», меню 220px со счётчиками
 * и блоком «СЕГОДНЯ», внизу линия отрыва.
 */

const NAV = [
  { to: '/admin', label: 'Дашборд', end: true },
  { to: '/admin/moderation', label: 'Модерация', badge: 'moderation' },
  { to: '/admin/verifications', label: 'Верификации', badge: 'verifications' },
  { to: '/admin/users', label: 'Пользователи' },
  { to: '/admin/companies', label: 'Компании' },
  { to: '/admin/support', label: 'Поддержка', badge: 'support' },
  { to: '/admin/journal', label: 'Журнал действий' },
];

const LIVE_EVENTS = ['offer_pending_review', 'event_pending_review', 'verification_pending', 'new_support_ticket', 'support_message'];

const AdminLayout = () => {
  const { user, loading } = useAuth();
  const { events } = useNotifications();
  const [counters, setCounters] = useState(null);

  const refresh = useCallback(() => {
    api
      .get('/admin/counters')
      .then((r) => setCounters(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return undefined;
    refresh();
    const t = setInterval(refresh, 60 * 1000);
    const onRefresh = () => refresh();
    window.addEventListener('admin-badges-refresh', onRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener('admin-badges-refresh', onRefresh);
    };
  }, [user, refresh]);

  // Новые заявки приходят по SSE — перечитываем счётчики.
  const liveKey = LIVE_EVENTS.map((k) => events?.[k]?.ts || '').join('|');
  useEffect(() => {
    if (user?.role === 'admin' && liveKey.replace(/\|/g, '')) refresh();
  }, [liveKey, user, refresh]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin') return <Navigate to="/" />;

  const c = counters || {};
  const pending = (c.moderation || 0) + (c.verifications || 0) + (c.support || 0);
  const name = shortName(user.full_name || user.nickname || '');

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-10 pt-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="font-display font-bold text-[20px] tracking-[-0.02em] text-ink whitespace-nowrap">
              СТУДЕНТ−%
            </Link>
            <span className="bg-ink text-on-ink font-mono font-bold text-[11px] tracking-[0.06em] px-2 py-[3px] whitespace-nowrap">АДМИН-ПАНЕЛЬ</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hidden md:inline font-mono font-medium text-[11px] tracking-[0.04em] text-ink whitespace-nowrap">
              ● LIVE · НОВЫХ ЗАЯВОК {num(pending)}
            </span>
            <Link to="/" className="hidden sm:inline font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink whitespace-nowrap">
              ← На сайт
            </Link>
            <Link to="/profile" className="flex items-center gap-[10px]">
              <Avatar src={user.avatar_url} name={name} size={28} />
              <span className="hidden sm:inline font-mono font-medium text-[11px] tracking-[0.04em] uppercase text-ink whitespace-nowrap">
                {name} · Админ
              </span>
            </Link>
          </div>
        </div>
        <Rule2 className="mt-[18px]" />

        <div className="mt-7 flex flex-col lg:flex-row items-start gap-6 lg:gap-10">
          <aside className="w-full lg:w-[220px] shrink-0">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center justify-between gap-3 py-[10px] whitespace-nowrap font-mono text-[12px] tracking-[0.04em] uppercase transition ${
                      isActive ? 'border-l-[3px] border-ink pl-3 font-bold text-ink' : 'text-ink-soft hover:text-ink pr-3 lg:pr-0'
                    }`
                  }
                >
                  <span>{item.label}</span>
                  {item.badge && c[item.badge] > 0 && (
                    <span className="bg-ink text-on-ink font-mono font-bold text-[10px] px-[6px] py-px">{c[item.badge] > 99 ? '99+' : c[item.badge]}</span>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="hidden lg:flex flex-col gap-[10px] pt-[14px]">
              <Rule />
              <span className="font-mono font-medium text-[10px] tracking-[0.06em] text-ink-soft">СЕГОДНЯ</span>
              <Leader label="Заказов" value={num(c.orders_today)} />
              <Leader label="Регистраций" value={num(c.registrations_today)} />
              <Leader label="Выручка" value={`${num(c.revenue_today)} ₽`} />
            </div>
          </aside>

          <VRule className="hidden lg:block" />

          <main className="flex-1 min-w-0 w-full">
            <Outlet context={{ counters: c, refreshCounters: refresh }} />
          </main>
        </div>
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-10 mt-auto pt-7 pb-8">
        <div className="tear-edge" />
        <div className="mt-3 flex items-center justify-between gap-4 flex-wrap font-mono text-[11px] tracking-[0.04em] uppercase">
          <span className="text-ink-faint">СТУДЕНТ−% · Админ · Все действия пишутся в журнал</span>
          <span className="text-ink-soft">
            Правила модерации · Регламент
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
