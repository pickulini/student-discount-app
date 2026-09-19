import React, { useState, useEffect } from 'react';
import { Link, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../api/client';

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
    return <div className="text-center py-8 text-red-500">Доступ запрещён. Только для администраторов.</div>;
  }

  const Badge = ({ count }) => {
    if (!count || count <= 0) return null;
    return (
      <span className="ml-auto inline-flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5">
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  const NavLink = ({ to, label, badge }) => (
    <Link
      to={to}
      className="flex items-center gap-2 p-2 rounded hover:bg-blue-50"
    >
      <span>{label}</span>
      <Badge count={badge} />
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-white shadow-md p-4">
        <h2 className="text-xl font-bold text-blue-600 mb-4">Админ-панель</h2>
        <nav className="space-y-2">
          <NavLink to="/admin" label="📊 Статистика" />
          <NavLink to="/admin/users" label="👥 Пользователи" />
          <NavLink to="/admin/companies" label="🏢 Компании" />
          <NavLink to="/admin/offers" label="🎁 Предложения" badge={badges.offers} />
          <NavLink to="/admin/verifications" label="✅ Верификации" badge={badges.verifications} />
          <NavLink to="/admin/support" label="💬 Чаты" badge={badges.support} />
          <Link to="/" className="flex items-center gap-2 p-2 rounded hover:bg-blue-50 text-blue-600">
            ← На сайт
          </Link>
        </nav>
      </aside>
      <div className="flex-1 p-6">
        <div className="bg-white p-6 rounded shadow">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
