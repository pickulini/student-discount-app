import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const timeAgo = (iso) => {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн назад`;
  return d.toLocaleDateString('ru-RU');
};

const Notifications = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    } catch {}
  };

  const removeItem = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const hasUnread = items.some((n) => !n.read_at);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Уведомления</h1>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="text-sm text-blue-600 hover:underline"
          >
            Прочитать все
          </button>
        )}
      </div>

      {loading && items.length === 0 ? (
        <div className="text-center py-8">Загрузка...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded shadow p-8 text-center text-gray-500">
          Уведомлений нет
        </div>
      ) : (
        <>
          <div className="bg-white rounded shadow divide-y">
            {items.map((n) => (
              <Link
                key={n.id}
                to={n.link || '/notifications'}
                onClick={() => { removeItem(n.id); }}
                className={`block p-4 hover:bg-gray-50 ${n.read_at ? '' : 'bg-blue-50'}`}
              >
                <div className="flex gap-3">
                  {n.actor_avatar ? (
                    <img src={n.actor_avatar} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                      🔔
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800">{n.title}</div>
                    {n.body && <div className="text-sm text-gray-600 mt-0.5">{n.body}</div>}
                    <div className="text-xs text-gray-400 mt-1">
                      {timeAgo(n.created_at)}
                      {!n.read_at && <span className="ml-2 text-blue-600">• новое</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-4">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-sm disabled:opacity-50"
              >
                {loading ? 'Загрузка...' : 'Показать ещё'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Notifications;
