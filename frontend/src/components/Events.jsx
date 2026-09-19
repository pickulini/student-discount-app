import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import EventCard from './EventCard';
import EventDetailModal from './EventDetailModal';
import { useAuth } from '../context/AuthContext';

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
        <h1 className="text-3xl font-bold text-gray-800">Ивенты</h1>
        {isVerified && (
          <Link
            to="/events/new"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Предложить ивент
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-2 text-sm ${
            tab === 'all' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'
          }`}
        >
          Все ивенты
        </button>
        <button
          onClick={() => setTab('my')}
          className={`px-4 py-2 text-sm ${
            tab === 'my' ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'
          }`}
        >
          Мои ивенты
        </button>
      </div>

      {!isVerified && user && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded p-3 mb-4 text-sm">
          Ивенты доступны только верифицированным студентам. Пройдите верификацию в профиле.
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Загрузка...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {tab === 'my' ? 'У вас пока нет ивентов' : 'Пока нет ивентов'}
        </div>
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
