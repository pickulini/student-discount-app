import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import {
  NOTIFICATION_GROUPS,
  GROUP_ORDER,
  groupNotifications,
  timeAgo,
  GROUPING_THRESHOLD,
} from '../utils/notificationGroups';

const NotificationBell = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unreadCount, lastNotification, refreshCount, reconnectCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (reconnectCount === 0) return;
    refreshCount();
    if (open) {
      api.get('/notifications?filter=unread')
        .then((res) => setItems(res.data || []))
        .catch(() => {});
    }
  }, [reconnectCount]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get('/notifications?filter=unread')
      .then((res) => setItems(res.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, lastNotification]);

  // Оптимистично убираем из UI + шлём DELETE с keepalive (не отменяется при навигации)
  const handleClick = async (n) => {
    // Оптимистично убираем из UI
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    setOpen(false);

    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`/api/v1/notifications/${n.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error('DELETE failed:', res.status);
      }
    } catch (err) {
      console.error('DELETE error:', err);
    }

    // Обновляем счётчик уже после удаления
    refreshCount();

    // Затем навигация
    navigate(n.link || '/notifications');
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setItems([]); // в bell показываем только непрочитанные — очищаем
      refreshCount();
    } catch {}
  };

  if (!user) return null;

  const grouped = groupNotifications(items);
  const shouldGroup = items.length > GROUPING_THRESHOLD;
  const activeGroups = GROUP_ORDER.filter((k) => grouped[k] && grouped[k].length > 0);

  const renderItem = (n, compact = false) => (
    <button
      onClick={() => handleClick(n)}
      className={`w-full text-left block hover:bg-gray-50 ${n.read_at ? '' : 'bg-blue-50'} ${compact ? 'p-2' : 'p-3'}`}
    >
      <div className="flex gap-2">
        {n.actor_avatar ? (
          <img
            src={n.actor_avatar}
            alt=""
            className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} rounded-full object-cover flex-shrink-0`}
          />
        ) : (
          <div className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs flex-shrink-0`}>
            🔔
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-800 line-clamp-2`}>
            {n.title}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</div>
        </div>
      </div>
    </button>
  );

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
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-50 max-h-[500px] flex flex-col">
          <div className="flex justify-between items-center p-3 border-b">
            <span className="font-semibold text-sm">Уведомления</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-red-500 hover:underline">
                Удалить все
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Загрузка...</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">Нет новых уведомлений</div>
            ) : !shouldGroup ? (
              <ul>
                {items.map((n) => (
                  <li key={n.id} className="border-b last:border-0">
                    {renderItem(n)}
                  </li>
                ))}
              </ul>
            ) : (
              <div>
                {activeGroups.map((gk) => {
                  const g = NOTIFICATION_GROUPS[gk];
                  const list = grouped[gk];
                  const unreadInGroup = list.filter((n) => !n.read_at).length;
                  const isExpanded = expandedGroup === gk;
                  return (
                    <div key={gk} className="border-b last:border-0">
                      <button
                        onClick={() => setExpandedGroup(isExpanded ? null : gk)}
                        className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 text-left"
                      >
                        <span className="text-lg">{g.icon}</span>
                        <span className="flex-1 text-sm font-medium text-gray-800">{g.label}</span>
                        <span className="text-xs text-gray-500">{list.length}</span>
                        {unreadInGroup > 0 && (
                          <span className="ml-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {unreadInGroup}
                          </span>
                        )}
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="bg-gray-50">
                          {list.map((n) => (
                            <div key={n.id} className="border-t">
                              {renderItem(n, true)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => { setOpen(false); navigate('/notifications'); }}
            className="block w-full p-3 text-center text-sm text-blue-600 hover:bg-blue-50 border-t"
          >
            Все уведомления
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
