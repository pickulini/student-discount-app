import React from 'react';
import { Link } from 'react-router-dom';

/** Общие кусочки админ-панели (A01–A10). */

/** «Елена Серова» → «Е. Серова». */
export const shortName = (full = '') => {
  const p = String(full).trim().split(/\s+/).filter(Boolean);
  if (p.length < 2) return p[0] || '';
  return `${p[0][0]}. ${p[p.length - 1]}`;
};

/** Заголовок страницы: 32px, подзаголовок 15px, справа — переключатель или кнопка. */
export const AdminHead = ({ title, subtitle, right, className = '' }) => (
  <div className={`flex items-end justify-between gap-4 flex-wrap ${className}`}>
    <div className="flex flex-col gap-2 min-w-0">
      <h1 className="font-display font-bold text-[28px] sm:text-[32px] leading-none tracking-[-0.02em] text-ink uppercase">{title}</h1>
      {subtitle && <p className="text-[15px] text-ink-soft">{subtitle}</p>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);

/** Хлебные крошки: [{to,label}, 'последний']. */
export const Crumbs = ({ items }) => (
  <div className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft whitespace-pre">
    {items.map((it, i) => (
      <React.Fragment key={i}>
        {i > 0 && '  /  '}
        {typeof it === 'string' ? it : <Link to={it.to} className="hover:text-ink">{it.label}</Link>}
      </React.Fragment>
    ))}
  </div>
);

/** Продолжительность: «3 ч 12 мин», «40 мин», «2 дн 4 ч». */
export const durationLabel = (ms) => {
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 1) return 'меньше минуты';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} ч ${m % 60} мин` : `${h} ч`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} дн ${h % 24} ч` : `${d} дн`;
};

/** «3 Ч НАЗАД», «40 МИН» (как в очереди модерации). */
export const agoShort = (d) => {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${Math.max(m, 1)} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return null;
};

export const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export const MONTHS_DAT = ['январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю'];

/** Кнопка-чекбокс «[×] ТЕКСТ» / «[ ] ТЕКСТ». */
export const CheckLine = ({ checked, onChange, children, disabled = false }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`flex gap-[10px] items-start text-left font-mono text-[11px] tracking-[0.04em] uppercase transition ${
      checked ? 'text-ink font-bold' : 'text-ink-soft hover:text-ink'
    }`}
  >
    <span className={`font-bold whitespace-nowrap ${checked ? 'text-ink' : 'text-ink-faint'}`}>{checked ? '[×]' : '[ ]'}</span>
    <span>{children}</span>
  </button>
);

/** Номер: 1960 → «№ 001960». */
export const no6 = (id) => `№ ${String(id || 0).padStart(6, '0')}`;
