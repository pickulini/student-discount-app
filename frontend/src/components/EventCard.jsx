import React from 'react';
import { formatRecurrence } from '../utils/recurrence';
import { RouteMark } from '../design/DottedPath';

const EventCard = ({ event, onClick }) => {
  const isPaid = event.special_price && event.special_price > 0;
  const priceText = isPaid ? `${event.special_price} ₽` : 'Бесплатно';

  const coverSrc = event.image_url || null;
  const startDate = new Date(event.start_at);
  const dayNum = startDate.toLocaleDateString('ru-RU', { day: 'numeric' });
  const monthShort = startDate.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '').toUpperCase();
  const time = startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      onClick={() => onClick(event)}
      className="relative bg-surface rounded-[var(--radius-md)] border border-line hover:border-ink-faint transition-colors duration-200 cursor-pointer overflow-hidden flex flex-col h-full"
    >
      {/* Дата — афишный акцент, как в разделе 10 ТЗ: "24 СЕН" крупно и заметно. */}
      <div className="absolute top-3 left-3 z-10 bg-bg/85 backdrop-blur rounded-[var(--radius-sm)] px-2.5 py-1.5 text-center leading-none">
        <div className="text-editorial text-xl text-ink">{dayNum}</div>
        <div className="text-eyebrow text-ink-faint mt-0.5">{monthShort}</div>
      </div>

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
          <h3 className="text-editorial text-base text-ink uppercase line-clamp-2">{event.title}</h3>
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

        <div className="text-caption text-xs text-ink-faint mt-1">
          {event.address ? `${event.address} · ` : ''}{time}
        </div>

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
