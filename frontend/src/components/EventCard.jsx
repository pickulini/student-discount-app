import React from 'react';
import { formatRecurrence } from '../utils/recurrence';
import { RouteMark } from '../design/DottedPath';

const EventCard = ({ event, onClick }) => {
  const isPaid = event.special_price && event.special_price > 0;
  const priceText = isPaid ? `${event.special_price} ₽` : 'Бесплатно';

  const coverSrc = event.image_url || null;
  const startDate = new Date(event.start_at);
  const day = startDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const time = startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      onClick={() => onClick(event)}
      className="bg-surface rounded-[var(--radius-md)] border border-line hover:border-ink-faint transition-colors duration-200 cursor-pointer overflow-hidden flex flex-col h-full"
    >
      {coverSrc ? (
        <div
          className="w-full h-40 bg-cover bg-center bg-surface-2"
          style={{ backgroundImage: `url('${coverSrc}')` }}
        />
      ) : (
        <div className="w-full h-40 bg-surface-2 flex items-center justify-center">
          <RouteMark />
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-lg font-semibold text-ink line-clamp-2">{event.title}</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-[var(--radius-xs)] whitespace-nowrap ${
            isPaid ? 'bg-accent/10 text-accent' : 'bg-surface-2 text-ink-soft'
          }`}>
            {priceText}
          </span>
        </div>

        {event.recurrence_rule && (
          <div className="mt-1 inline-block bg-surface-2 text-ink-soft text-xs font-medium px-2 py-0.5 rounded-[var(--radius-xs)] self-start">
            🔄 {formatRecurrence(event.recurrence_rule, event.recurrence_until)}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {day}, {time}
          </span>
        </div>

        {event.address && (
          <div className="mt-1 flex items-start gap-1 text-xs text-ink-faint line-clamp-2">
            <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span>{event.address}</span>
          </div>
        )}

        {event.my_attendee_status === 'going' && (
          <div className="mt-2 inline-block bg-accent/10 text-accent text-xs font-medium px-2 py-0.5 rounded-[var(--radius-xs)] self-start">
            ✓ Вы идёте
          </div>
        )}
        {event.my_attendee_status === 'interested' && (
          <div className="mt-2 inline-block bg-surface-2 text-ink-soft text-xs font-medium px-2 py-0.5 rounded-[var(--radius-xs)] self-start">
            ⭐ Вы интересуетесь
          </div>
        )}
      </div>
    </div>
  );
};

export default EventCard;
