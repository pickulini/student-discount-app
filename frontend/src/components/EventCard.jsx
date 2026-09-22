import React from 'react';
import { RouteMark } from '../design/DottedPath';

/** Безрамочная карточка ивента. `size="lg"` — крупный вариант для
    основной вертикальной ленты, `size="md"` — для карусели. Без эмодзи:
    статус и повторяемость — обычным текстом, не значками. */
const EventCard = ({ event, onClick, size = 'md' }) => {
  const isPaid = event.special_price && event.special_price > 0;
  const priceText = isPaid ? `${event.special_price} ₽` : 'Бесплатно';

  const coverSrc = event.image_url || null;
  const startDate = new Date(event.start_at);
  const dayNum = startDate.toLocaleDateString('ru-RU', { day: 'numeric' });
  const monthShort = startDate.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '').toUpperCase();
  const time = startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const isLg = size === 'lg';

  return (
    <div onClick={() => onClick(event)} className="relative cursor-pointer group">
      {/* Дата — афишный акцент прямо на фото (ТЗ, раздел 10: "24 СЕН"). */}
      <div className="absolute top-3 left-3 z-10 bg-bg/85 backdrop-blur rounded-[var(--radius-sm)] px-2.5 py-1.5 text-center leading-none">
        <div className="text-editorial text-xl text-ink">{dayNum}</div>
        <div className="text-eyebrow text-ink-faint mt-0.5">{monthShort}</div>
      </div>

      {coverSrc ? (
        <div className="overflow-hidden rounded-[var(--radius-sm)]">
          <div
            className={`media-hover w-full ${isLg ? 'h-64 sm:h-80' : 'h-44 sm:h-48'} bg-cover bg-center bg-surface-2`}
            style={{ backgroundImage: `url('${coverSrc}')` }}
          />
        </div>
      ) : (
        <div className={`w-full ${isLg ? 'h-64 sm:h-80' : 'h-44 sm:h-48'} bg-surface-2 rounded-[var(--radius-sm)] flex items-center justify-center`}>
          <RouteMark />
        </div>
      )}

      <div className="pt-3">
        <h3 className={`text-editorial ${isLg ? 'text-xl' : 'text-base'} text-ink uppercase group-hover:text-accent transition-colors line-clamp-2`}>
          {event.title}
        </h3>

        {isLg && event.description && (
          <p className="text-ink-soft text-sm mt-2 line-clamp-2">{event.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className={isPaid ? 'text-ink' : 'text-accent'}>{priceText}</span>
          {event.address && (
            <>
              <span className="text-ink-faint">·</span>
              <span className="text-ink-faint line-clamp-1">{event.address}</span>
            </>
          )}
          <span className="text-ink-faint">·</span>
          <span className="text-caption text-ink-faint">{time}</span>
        </div>

        {event.my_attendee_status === 'going' && (
          <div className="mt-1 text-xs text-accent">Вы идёте</div>
        )}
        {event.my_attendee_status === 'interested' && (
          <div className="mt-1 text-xs text-ink-soft">Вы интересуетесь</div>
        )}
      </div>
    </div>
  );
};

export default EventCard;
