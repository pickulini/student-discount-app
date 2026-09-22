import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import {
  NOTIFICATION_GROUPS,
  GROUP_ORDER,
  groupNotifications,
  timeAgo,
} from '../utils/notificationGroups';
import { RouteLoadingView, RouteEmptyState } from '../design/DottedPath';
import { Card, Button } from '../design/UI';

const Notifications = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 30;

  const fetchItems = (off = 0) => {
    setLoading(true);
    api.get(`/notifications?limit=${LIMIT}&offset=${off}`)
      .then((res) => {
        const data = res.data || [];
        if (off === 0) setItems(data);
        else setItems((prev) => [...prev, ...data]);
        setHasMore(data.length === LIMIT);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems(0);
  }, []);

  const loadMore = () => {
    const next = offset + LIMIT;
    setOffset(next);
    fetchItems(next);
  };

  const handleClickItem = async (n) => {
    // Оптимистично убираем из UI
    setItems((prev) => prev.filter((x) => x.id !== n.id));

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

    navigate(n.link || '/notifications');
  };

  const deleteAll = async () => {
    if (!confirm('Удалить все уведомления?')) return;
    try {
      await api.delete('/notifications/all');
      setItems([]);
    } catch {}
  };

  const removeItem = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const grouped = useMemo(() => groupNotifications(items), [items]);
  const hasUnread = items.some((n) => !n.read_at);

  const visibleItems = tab === 'all' ? items : (grouped[tab] || []);

  const tabCounts = useMemo(() => {
    const counts = { all: items.length };
    GROUP_ORDER.forEach((k) => { counts[k] = (grouped[k] || []).length; });
    return counts;
  }, [grouped, items]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-ink">Уведомления</h1>
        {items.length > 0 && (
          <button onClick={deleteAll} className="text-sm text-accent hover:underline">
            Прочитать все
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-line overflow-x-auto">
        <button
          onClick={() => setTab('all')}
          className={`px-3 py-2 text-sm whitespace-nowrap transition ${
            tab === 'all' ? 'border-b-2 border-accent text-accent font-semibold' : 'text-ink-soft hover:text-ink'
          }`}
        >
          Все {tabCounts.all > 0 && <span className="text-xs text-ink-faint">({tabCounts.all})</span>}
        </button>
        {GROUP_ORDER.map((gk) => {
          const g = NOTIFICATION_GROUPS[gk];
          if (!g) return null;
          const cnt = tabCounts[gk] || 0;
          if (cnt === 0) return null;
          return (
            <button
              key={gk}
              onClick={() => setTab(gk)}
              className={`px-3 py-2 text-sm whitespace-nowrap transition ${
                tab === gk ? 'border-b-2 border-accent text-accent font-semibold' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {g.icon} {g.shortLabel} <span className="text-xs text-ink-faint">({cnt})</span>
            </button>
          );
        })}
      </div>

      {loading && items.length === 0 ? (
        <RouteLoadingView label="Загрузка..." />
      ) : visibleItems.length === 0 ? (
        <Card className="p-8 text-center text-ink-soft">
          {tab === 'all' ? 'Уведомлений нет' : 'В этой категории нет уведомлений'}
        </Card>
      ) : (
        <>
          <Card className="divide-y divide-line overflow-hidden">
            {visibleItems.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClickItem(n)}
                className={`w-full text-left block p-4 hover:bg-surface-2 transition ${n.read_at ? '' : 'bg-surface-2/60'}`}
              >
                <div className="flex gap-3">
                  {n.actor_avatar ? (
                    <img src={n.actor_avatar} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-surface-2 border border-line flex items-center justify-center text-accent flex-shrink-0">
                      🔔
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink">{n.title}</div>
                    {n.body && <div className="text-sm text-ink-soft mt-0.5">{n.body}</div>}
                    <div className="text-xs text-ink-faint mt-1">
                      {timeAgo(n.created_at)}
                      {!n.read_at && <span className="ml-2 text-accent">• новое</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </Card>

          {hasMore && tab === 'all' && (
            <div className="text-center mt-4">
              <Button variant="ghost" onClick={loadMore} disabled={loading} className="text-sm">
                {loading ? 'Загрузка...' : 'Показать ещё'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Notifications;
