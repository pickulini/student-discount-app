import React from 'react';
import { RouteMark } from '../design/DottedPath';
import { LeaderRow } from '../design/UI';

/** Карточка ивента — язык кассового чека (Figma «01 · Главная»,
    блок «Event · …»): фото, число+месяц, название, «вход студентам»
    строкой с отточием, кнопка «[ Пойду ]». */
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
    <div onClick={() => onClick(event)} className="cursor-pointer group w-full">
      <div className="overflow-hidden relative">
        {coverSrc ? (
          <div
            className={`media-hover w-full ${isLg ? 'h-52 sm:h-56' : 'h-28'} bg-cover bg-center bg-surface-2`}
            style={{ backgroundImage: `url('${coverSrc}')` }}
          />
        ) : (
          <div className={`w-full ${isLg ? 'h-52 sm:h-56' : 'h-28'} bg-surface-2 flex items-center justify-center`}>
            <RouteMark />
          </div>
        )}
      </div>

      <div className="pt-3 flex items-start gap-3">
        <div className="text-center leading-none shrink-0">
          <div className="text-editorial text-xl text-ink">{dayNum}</div>
          <div className="text-eyebrow text-[10px] mt-0.5">{monthShort}</div>
        </div>
        <div className="w-px self-stretch" style={{ borderLeft: '1px dashed var(--color-line)' }} />
        <div className="flex-1 min-w-0">
          <h3 className="text-editorial text-lg text-ink uppercase group-hover:text-accent transition-colors line-clamp-1">
            {event.title}
          </h3>
          <div className="text-sm text-ink-soft mt-1 line-clamp-1">
            {time}{event.address ? ` · ${event.address}` : ''}
          </div>
        </div>
      </div>

      {isLg && event.description && (
        <p className="text-ink-soft text-sm mt-2 line-clamp-2">{event.description}</p>
      )}

      <div className="mt-3">
        <LeaderRow
          label="Вход студентам"
          value={priceText}
          valueClassName={isPaid ? '' : 'text-ink-red font-bold'}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-caption text-xs text-ink-faint">
          {event.my_attendee_status === 'going' ? 'ВЫ ИДЁТЕ' : event.my_attendee_status === 'interested' ? 'ИНТЕРЕСУЕТЕСЬ' : ' '}
        </span>
        <span className="btn-bracket">Пойду</span>
      </div>
    </div>
  );
};

export default EventCard;
