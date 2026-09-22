import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Card, Button, PageTitle, Badge } from '../design/UI';
import { RouteLoadingView, RouteEmptyState } from '../design/DottedPath';

const MerchantEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchEvents = () => {
    setLoading(true);
    const params = {};
    if (filterStatus !== 'all') params.status = filterStatus;
    api.get('/merchant/events', { params })
      .then(res => setEvents(res.data || []))
      .catch(err => {
        console.error(err);
        setEvents([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvents();
  }, [filterStatus]);

  const submitForReview = async (id) => {
    try {
      await api.post(`/events/${id}/submit`);
      fetchEvents();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <PageTitle className="mb-0">Мои ивенты</PageTitle>
        <Link to="/events/new">
          <Button>+ Создать ивент</Button>
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm text-ink-soft">Фильтр:</label>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-transparent border-b border-line focus:border-accent outline-none py-1.5 text-sm text-ink transition"
        >
          <option value="all">Все</option>
          <option value="draft">Черновики</option>
          <option value="pending_review">На модерации</option>
          <option value="published">Опубликованные</option>
          <option value="rejected">Отклонённые</option>
        </select>
      </div>

      {loading ? (
        <RouteLoadingView label="Загрузка..." />
      ) : events.length === 0 ? (
        <RouteEmptyState title="У вас пока нет ивентов" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="p-2 text-left text-eyebrow">Дата</th>
                <th className="p-2 text-left text-eyebrow">Название</th>
                <th className="p-2 text-left text-eyebrow">Компания</th>
                <th className="p-2 text-left text-eyebrow">Приватность</th>
                <th className="p-2 text-left text-eyebrow">Статус</th>
                <th className="p-2 text-left text-eyebrow">Действия</th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="p-2 whitespace-nowrap text-caption text-ink">
                    {new Date(e.start_at).toLocaleDateString('ru-RU', {
                      day: 'numeric', month: 'short', year: '2-digit',
                    })}
                  </td>
                  <td className="p-2 max-w-xs truncate text-ink">{e.title}</td>
                  <td className="p-2 text-ink-soft">{e.company_id || '—'}</td>
                  <td className="p-2 text-xs text-ink-soft">{e.event_privacy}</td>
                  <td className="p-2">
                    <Badge filled={e.status === 'published'}>{e.status}</Badge>
                  </td>
                  <td className="p-2 space-x-2">
                    {e.status === 'draft' && (
                      <Button variant="ghost" onClick={() => submitForReview(e.id)} className="px-2 py-1 text-xs">
                        На модерацию
                      </Button>
                    )}
                    {e.status === 'published' && (
                      <Link to="/events" className="text-accent hover:underline text-xs">
                        Смотреть
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

export default MerchantEvents;
