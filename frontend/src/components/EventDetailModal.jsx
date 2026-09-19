import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const EventDetailModal = ({ event: initialEvent, onClose, onAttendeeChange }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(initialEvent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialEvent) return;
    api.get(`/events/${initialEvent.id}`)
      .then(res => setEvent(res.data))
      .catch(() => {});
  }, [initialEvent?.id]);

  if (!event) return null;

  const isPaid = event.special_price && event.special_price > 0;
  const startDate = new Date(event.start_at);
  const endDate = new Date(event.end_at);
  const isGoing = event.my_attendee_status === 'going';

  const handleSchedule = async () => {
    if (!user) {
      onClose();
      navigate('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/events/${event.id}/schedule`);
      const order = res.data;

      if (!isPaid || order.status === 'paid') {
        // бесплатный — сразу paid
        await api.post(`/orders/${order.id}/confirm`).catch(() => {});
        setEvent({ ...event, my_attendee_status: 'going' });
        if (onAttendeeChange) onAttendeeChange();
      } else {
        // платный — ведём в /order
        onClose();
        navigate('/order');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Отменить участие?')) return;
    setLoading(true);
    try {
      await api.delete(`/events/${event.id}/schedule`);
      setEvent({ ...event, my_attendee_status: null });
      if (onAttendeeChange) onAttendeeChange();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold text-gray-800">{event.title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${
              isPaid ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {isPaid ? `${event.special_price} ₽` : 'Бесплатно'}
            </span>
            {isGoing && (
              <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                ✓ Вы идёте
              </span>
            )}
            {event.attendees_count > 0 && (
              <span className="bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1 rounded-full">
                {event.attendees_count} идут
              </span>
            )}
          </div>

          {event.image_url && (
            <div
              className="mt-4 w-full h-56 bg-cover bg-center rounded-lg bg-gray-100"
              style={{ backgroundImage: `url('${event.image_url}')` }}
            />
          )}

          {event.description && (
            <p className="mt-4 text-gray-700 whitespace-pre-line">{event.description}</p>
          )}

          <div className="mt-6 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-gray-600">Начало</p>
              <p className="text-gray-800">
                {startDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' в '}
                {startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-600">Окончание</p>
              <p className="text-gray-800">
                {endDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {event.address && (
              <div className="md:col-span-2">
                <p className="font-semibold text-gray-600">Место</p>
                <p className="text-gray-800">{event.address}</p>
              </div>
            )}
          </div>

          {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}

          <div className="mt-6 flex gap-3">
            {isGoing ? (
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 border border-red-300 text-red-600 py-2 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
              >
                {loading ? '...' : 'Отменить участие'}
              </button>
            ) : (
              <button
                onClick={handleSchedule}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? '...' : isPaid ? 'Запланировать' : 'Пойду'}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailModal;
