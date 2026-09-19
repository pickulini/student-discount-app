import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

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
        <h2 className="text-2xl font-bold">Мои ивенты</h2>
        <Link
          to="/events/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Создать ивент
        </Link>
      </div>

      <div className="mb-4 flex gap-2">
        <label className="text-sm">Фильтр:</label>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border rounded p-1 text-sm"
        >
          <option value="all">Все</option>
          <option value="draft">Черновики</option>
          <option value="pending_review">На модерации</option>
          <option value="published">Опубликованные</option>
          <option value="rejected">Отклонённые</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">Загрузка...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          У вас пока нет ивентов
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Дата</th>
                <th className="p-2 text-left">Название</th>
                <th className="p-2 text-left">Компания</th>
                <th className="p-2 text-left">Приватность</th>
                <th className="p-2 text-left">Статус</th>
                <th className="p-2 text-left">Действия</th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr key={e.id} className="border-b">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(e.start_at).toLocaleDateString('ru-RU', {
                      day: 'numeric', month: 'short', year: '2-digit',
                    })}
                  </td>
                  <td className="p-2 max-w-xs truncate">{e.title}</td>
                  <td className="p-2">{e.company_id || '—'}</td>
                  <td className="p-2 text-xs">{e.event_privacy}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-white text-xs ${
                      e.status === 'published' ? 'bg-green-500' :
                      e.status === 'pending_review' ? 'bg-yellow-500' :
                      e.status === 'rejected' ? 'bg-red-500' :
                      e.status === 'archived' ? 'bg-gray-500' : 'bg-gray-400'
                    }`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="p-2 space-x-2">
                    {e.status === 'draft' && (
                      <button
                        onClick={() => submitForReview(e.id)}
                        className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                      >
                        На модерацию
                      </button>
                    )}
                    {e.status === 'published' && (
                      <Link
                        to={`/events`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Смотреть
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MerchantEvents;
