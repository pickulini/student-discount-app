import React, { useState, useEffect } from 'react';
import { Link, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../api/client';
import { RouteMark } from '../design/DottedPath';

const AdminLayout = () => {
  const { user, isAdmin } = useAuth();
  const { events, reconnectCount } = useNotifications(!!user);
  const [badges, setBadges] = useState({
    offers: 0,
    verifications: 0,
    support: 0,
  });

  // начальная загрузка счётчиков
  useEffect(() => {
    if (!user || !isAdmin()) return;

    const fetchCounts = async () => {
      try {
        const [offers, vers, tickets] = await Promise.all([
          api.get('/admin/offers').catch(() => ({ data: [] })),
          api.get('/admin/verifications').catch(() => ({ data: [] })),
          api.get('/admin/support/tickets').catch(() => ({ data: [] })),
        ]);

        const pendingOffers = (offers.data || []).filter(
          (o) => o.status === 'pending_review'
        ).length;
        const pendingVers = (vers.data || []).filter(
          (v) => v.status === 'pending'
        ).length;
        const openTickets = (tickets.data || []).filter(
          (t) => t.status === 'open' || t.status === 'in_progress'
        ).length;

        setBadges({
          offers: pendingOffers,
          verifications: pendingVers,
          support: openTickets,
        });
      } catch (err) {
        console.error('Badge fetch error:', err);
      }
    };

    fetchCounts();

    const handler = () => fetchCounts();
    window.addEventListener('admin-badges-refresh', handler);
    return () => window.removeEventListener('admin-badges-refresh', handler);
  }, [user]);

  // При переподключении SSE — перечитываем бейджи
  useEffect(() => {
    if (reconnectCount === 0 || !user || !isAdmin()) return;
    // триггерим перезагрузку через сброс состояния
    // (объединять с основным useEffect не будем — просто перезапускаем)
    window.dispatchEvent(new Event('admin-badges-refresh'));
  }, [reconnectCount]);

  // realtime-инкременты
  useEffect(() => {
    if (!events.offer_pending_review && !events.event_pending_review) return;
    setBadges((prev) => ({ ...prev, offers: prev.offers + 1 }));
  }, [events.offer_pending_review, events.event_pending_review]);

  useEffect(() => {
    if (!events.verification_pending) return;
    setBadges((prev) => ({ ...prev, verifications: prev.verifications + 1 }));
  }, [events.verification_pending]);

  useEffect(() => {
    if (!events.new_support_ticket && !events.support_message) return;
    // на новое сообщение в открытый тикет уже не увеличиваем — просто на новый тикет
    if (events.new_support_ticket) {
      setBadges((prev) => ({ ...prev, support: prev.support + 1 }));
    }
  }, [events.new_support_ticket, events.support_message]);

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!isAdmin()) {
    return <div className="text-center py-8 text-danger">Доступ запрещён. Только для администраторов.</div>;
  }

  const Badge = ({ count }) => {
    if (!count || count <= 0) return null;
    return (
      <span className="ml-auto inline-flex items-center justify-center bg-accent text-accent-ink text-xs font-semibold rounded-[var(--radius-xs)] min-w-[20px] h-5 px-1.5">
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  const NavLink = ({ to, label, badge }) => (
    <Link
      to={to}
      className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-xs)] hover:bg-surface-2 text-ink-soft hover:text-ink text-sm transition"
    >
      <span>{label}</span>
      <Badge count={badge} />
    </Link>
  );

  return (
    <div className="min-h-screen flex text-ink">
      <aside className="w-64 bg-bg border-r border-line p-4 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-6 px-1">
          <RouteMark />
          <span className="text-sm font-semibold tracking-wide text-ink">Админ-панель</span>
        </div>
        <nav className="space-y-1">
          <NavLink to="/admin" label="Статистика" />
          <NavLink to="/admin/users" label="Пользователи" />
          <NavLink to="/admin/companies" label="Компании" />
          <NavLink to="/admin/offers" label="Предложения" badge={badges.offers} />
          <NavLink to="/admin/verifications" label="Верификации" badge={badges.verifications} />
          <NavLink to="/admin/support" label="Чаты" badge={badges.support} />
          <div className="border-t border-line my-2" />
          <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-xs)] hover:bg-surface-2 text-accent text-sm transition">
            ← На сайт
          </Link>
        </nav>
      </aside>
      <div className="flex-1 p-6">
        <div className="bg-surface border border-line rounded-[var(--radius-md)] p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
