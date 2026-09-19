import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

const timeAgo = (iso) => {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} дн назад`;
};

const NotificationBell = () => {
  const { user } = useAuth();
  const { unreadCount, lastNotification, refreshCount, reconnectCount } = useNotifications(!!user);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  // Закрытие по клику вне
  useEffect(() => {
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // При открытии — загружаем последние 10
  useEffect(() => {
    if (reconnectCount === 0) return;
    refreshCount();
    if (open) {
      api.get('/notifications?limit=10')
        .then((res) => setItems(res.data || []))
        .catch(() => {});
    }
  }, [reconnectCount]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get('/notifications?limit=10')
      .then((res) => setItems(res.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, lastNotification]);

  const removeItem = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setItems((prev) => prev.filter((n) => n.id !== id));
      refreshCount();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      refreshCount();
    } catch {}
  };

  if (!user) return null;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded hover:bg-blue-50 text-gray-700"
        title="Уведомления"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center p-3 border-b">
            <span className="font-semibold text-sm">Уведомления</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:underline"
              >
                Прочитать все
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-4 text-center text-gray-500 text-sm">Загрузка...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              Уведомлений нет
            </div>
          ) : (
            <ul>
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`border-b last:border-0 ${n.read_at ? '' : 'bg-blue-50'}`}
                >
                  <Link
                    to={n.link || '/notifications'}
                    onClick={() => {
                      removeItem(n.id);
                      setOpen(false);
                    }}
                    className="block p-3 hover:bg-gray-50"
                  >
                    <div className="flex gap-2">
                      {n.actor_avatar ? (
                        <img
                          src={n.actor_avatar}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                          🔔
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 line-clamp-2">
                          {n.title}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {timeAgo(n.created_at)}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block p-3 text-center text-sm text-blue-600 hover:bg-blue-50 border-t"
          >
            Все уведомления
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
