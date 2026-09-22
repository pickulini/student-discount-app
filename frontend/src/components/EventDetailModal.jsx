import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { formatRecurrence } from '../utils/recurrence';
import { useAuth } from '../context/AuthContext';
import { Button, ErrorText, Badge } from '../design/UI';

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

  const handleInterested = async () => {
    if (!user) {
      onClose();
      navigate('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const isCurrentlyInterested = event.my_attendee_status === 'interested';
      await api.post(`/events/${event.id}/rsvp`, {
        status: isCurrentlyInterested ? 'none' : 'interested',
      });
      const res = await api.get(`/events/${event.id}`);
      setEvent(res.data);
      if (onAttendeeChange) onAttendeeChange();
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-surface border border-line rounded-[var(--radius-lg)] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start gap-3">
            <h2 className="text-editorial text-2xl text-ink uppercase">{event.title}</h2>
            <button onClick={onClose} className="text-ink-faint hover:text-ink text-2xl leading-none">✕</button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <span className={`text-sm font-medium px-3 py-1 rounded-[var(--radius-xs)] ${
              isPaid ? 'bg-accent/10 text-accent' : 'bg-surface-2 text-ink-soft'
            }`}>
              {isPaid ? `${event.special_price} ₽` : 'Бесплатно'}
            </span>
            {isGoing && (
              <span className="bg-accent/10 text-accent text-sm font-medium px-3 py-1 rounded-[var(--radius-xs)]">
                ✓ Вы идёте
              </span>
            )}
            {event.my_attendee_status === 'interested' && (
              <span className="bg-surface-2 text-ink-soft text-sm font-medium px-3 py-1 rounded-[var(--radius-xs)]">
                ⭐ Вы интересуетесь
              </span>
            )}
            {event.attendees_count > 0 && (
              <span className="bg-surface-2 text-ink-soft text-sm font-medium px-3 py-1 rounded-[var(--radius-xs)]">
                {event.attendees_count} идут
              </span>
            )}
            {event.interested_count > 0 && (
              <span className="bg-surface-2 text-ink-soft text-sm font-medium px-3 py-1 rounded-[var(--radius-xs)]">
                ⭐ {event.interested_count} интересуются
              </span>
            )}
            {event.recurrence_rule && (
              <span className="bg-surface-2 text-ink-soft text-sm font-medium px-3 py-1 rounded-[var(--radius-xs)]">
                🔄 {formatRecurrence(event.recurrence_rule, event.recurrence_until)}
              </span>
            )}
          </div>

          {event.image_url && (
            <div
              className="mt-4 w-full h-56 bg-cover bg-center rounded-[var(--radius-md)] bg-surface-2"
              style={{ backgroundImage: `url('${event.image_url}')` }}
            />
          )}

          {event.description && (
            <p className="mt-4 text-ink-soft whitespace-pre-line">{event.description}</p>
          )}

          <div className="mt-6 border-t border-line pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-ink-soft">Начало</p>
              <p className="text-ink">
                {startDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' в '}
                {startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink-soft">Окончание</p>
              <p className="text-ink">
                {endDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {event.address && (
              <div className="md:col-span-2">
                <p className="font-semibold text-ink-soft">Место</p>
                <p className="text-ink">{event.address}</p>
              </div>
            )}
          </div>

          <ErrorText>{error}</ErrorText>

          <div className="mt-6 flex gap-3">
            {isGoing ? (
              <Button variant="danger" onClick={handleCancel} disabled={loading} className="flex-1 border border-danger/40">
                {loading ? '...' : 'Отменить участие'}
              </Button>
            ) : (
              <>
                <Button onClick={handleSchedule} disabled={loading} className="flex-1">
                  {loading ? '...' : isPaid ? 'Запланировать' : 'Пойду'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleInterested}
                  disabled={loading}
                  className={`flex-1 ${event.my_attendee_status === 'interested' ? 'border-accent text-accent' : ''}`}
                >
                  {loading ? '...' : event.my_attendee_status === 'interested' ? '⭐ Уже интересуюсь' : '⭐ Может быть'}
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Закрыть
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailModal;
