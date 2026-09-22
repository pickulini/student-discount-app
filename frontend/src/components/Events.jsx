import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import EventCard from './EventCard';
import EventDetailModal from './EventDetailModal';
import { useAuth } from '../context/AuthContext';
import { PageTitle, Button, Badge } from '../design/UI';
import { RouteLoadingView, RouteEmptyState } from '../design/DottedPath';

const Events = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('all'); // all | my

  const fetchEvents = () => {
    setLoading(true);
    const url = tab === 'my' ? '/events/my' : '/events';
    api.get(url)
      .then(res => setEvents(res.data || []))
      .catch(err => {
        console.error(err);
        setEvents([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvents();
  }, [tab]);

  const isVerified = user?.role === 'admin' || user?.role === 'merchant' || user?.student_status === 'verified';

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <PageTitle className="mb-0">Ивенты</PageTitle>
        {isVerified && (
          <Link to="/events/new">
            <Button>+ Предложить ивент</Button>
          </Link>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-line">
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-2 text-sm transition ${
            tab === 'all' ? 'border-b-2 border-accent text-accent font-semibold' : 'text-ink-soft hover:text-ink'
          }`}
        >
          Все ивенты
        </button>
        <button
          onClick={() => setTab('my')}
          className={`px-4 py-2 text-sm transition ${
            tab === 'my' ? 'border-b-2 border-accent text-accent font-semibold' : 'text-ink-soft hover:text-ink'
          }`}
        >
          Мои ивенты
        </button>
      </div>

      {!isVerified && user && (
        <div className="bg-surface-2 border border-line text-ink-soft rounded-[var(--radius-sm)] p-3 mb-4 text-sm">
          Ивенты доступны только верифицированным студентам. Пройдите верификацию в профиле.
        </div>
      )}

      {loading ? (
        <RouteLoadingView label="Загрузка..." />
      ) : events.length === 0 ? (
        <RouteEmptyState title={tab === 'my' ? 'У вас пока нет ивентов' : 'Пока нет ивентов'} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(e => (
            <EventCard
              key={e.id}
              event={e}
              onClick={setSelected}
            />
          ))}
        </div>
      )}

      {selected && (
        <EventDetailModal
          event={selected}
          onClose={() => setSelected(null)}
          onAttendeeChange={fetchEvents}
        />
      )}
    </div>
  );
};

export default Events;
