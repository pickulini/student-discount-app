import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Примитивы кабинета партнёра (Figma «Концепция «Чек», Партнёр · desktop»).
 * Размеры и начертания взяты из макета 1:1.
 */

// ---------- Форматирование ----------

export const rub = (v, { sign = false, cents = false } = {}) => {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  const body = cents
    ? abs.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(abs).toLocaleString('ru-RU');
  const prefix = n < 0 ? '−' : sign && n > 0 ? '+' : '';
  return `${prefix}${body} ₽`;
};

export const num = (v) => Math.round(Number(v || 0)).toLocaleString('ru-RU');

export const pad6 = (id) => String(id || 0).padStart(6, '0');

export const ddmm = (d) => (d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '');
export const ddmmyy = (d) => (d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '');
export const hhmm = (d) => (d ? new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '');
export const ddmmHHMM = (d) => (d ? `${ddmm(d)} ${hhmm(d)}` : '');

const MONTHS_DAT = ['январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю'];
export const monthDative = (d) => MONTHS_DAT[new Date(d).getMonth()];

export const plural = (n, one, few, many) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export const discountLabel = (o) =>
  o.discount_type === 'percentage' ? `−${Number(o.discount_value)}%` : `−${num(o.discount_value)} ₽`;

// ---------- Типографика ----------

/** Заголовок раздела внутри страницы: «ПОГАШЕНО ЗАКАЗОВ ПО ДНЯМ». */
export const SectionLabel = ({ children, className = '' }) => (
  <div className={`font-mono font-medium text-[11px] tracking-[0.08em] uppercase text-ink ${className}`}>{children}</div>
);

/** Второстепенная моно-подпись: «ОБНОВЛЕНО 02:04». */
export const Meta = ({ children, className = '' }) => (
  <div className={`font-mono text-[11px] tracking-[0.04em] text-ink-soft uppercase ${className}`}>{children}</div>
);

/** Шапка страницы кабинета: крупный заголовок, подпись, справа — действие. */
export const PageHead = ({ crumbs, title, subtitle, right }) => (
  <div>
    {crumbs && (
      <div className="font-mono text-[11px] tracking-[0.06em] uppercase text-ink-soft mb-[28px]">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="mx-3">/</span>}
            {c.to ? <Link to={c.to} className="hover:text-ink transition">{c.label}</Link> : <span>{c.label}</span>}
          </React.Fragment>
        ))}
      </div>
    )}
    <div className="flex items-end justify-between gap-6 flex-wrap">
      <div className="min-w-0">
        <h1 className="font-display font-bold text-[32px] leading-[1.25] tracking-[-0.02em] text-ink uppercase">{title}</h1>
        {subtitle && <div className="mt-2 text-[15px] text-ink-soft">{subtitle}</div>}
      </div>
      {right}
    </div>
  </div>
);

// ---------- Разделители ----------

export const Rule = ({ className = '' }) => <div className={`border-t border-dashed border-line ${className}`} />;
export const Rule2 = ({ className = '' }) => <div className={`h-[5px] border-y border-dashed border-ink ${className}`} />;
export const VRule = ({ className = '' }) => <div className={`w-px self-stretch border-l border-dashed border-line ${className}`} />;

// ---------- Кнопки ----------

export const PrimaryButton = ({ as: As = 'button', className = '', children, ...props }) => (
  <As
    className={`inline-flex items-center justify-center bg-ink text-on-ink font-mono font-bold text-[12px] tracking-[0.06em] uppercase px-[22px] py-[14px] hover:bg-ink/85 transition disabled:opacity-40 disabled:pointer-events-none ${className}`}
    {...props}
  >
    {children}
  </As>
);

export const SmallButton = ({ as: As = 'button', className = '', children, ...props }) => (
  <As
    className={`inline-flex items-center bg-ink text-on-ink font-mono font-bold text-[11px] tracking-[0.04em] uppercase px-[10px] py-[6px] hover:bg-ink/85 transition disabled:opacity-40 ${className}`}
    {...props}
  >
    {children}
  </As>
);

export const OutlineButton = ({ as: As = 'button', className = '', children, ...props }) => (
  <As
    className={`inline-flex items-center justify-center border border-dashed border-ink font-mono font-bold text-[12px] tracking-[0.06em] uppercase px-[20px] py-[13px] text-ink hover:bg-surface-2 transition disabled:opacity-40 ${className}`}
    {...props}
  >
    {children}
  </As>
);

export const TextButton = ({ as: As = 'button', className = '', children, ...props }) => (
  <As className={`btn-bracket py-[6px] hover:opacity-70 transition ${className}`} {...props}>
    {children}
  </As>
);

// ---------- Табы и сегменты ----------

/** Табы-фильтр: активный — чёрная плашка. items: [{key,label}] */
export const Tabs = ({ items, value, onChange, className = '' }) => (
  <div className={`flex items-center gap-4 flex-wrap ${className}`}>
    {items.map((it) =>
      it.key === value ? (
        <span key={it.key} className="bg-ink text-on-ink font-mono font-bold text-[12px] tracking-[0.04em] uppercase px-[6px] py-[2px]">
          {it.label}
        </span>
      ) : (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className="font-mono text-[12px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink transition"
        >
          {it.label}
        </button>
      )
    )}
  </div>
);

/** Сегментный переключатель (компания, тип скидки, ВКЛ/ВЫКЛ, период). */
export const Segmented = ({ items, value, onChange, dense = false, className = '' }) => (
  <div className={`inline-flex items-start ${className}`}>
    {items.map((it) => (
      <button
        type="button"
        key={String(it.key)}
        disabled={it.disabled}
        title={it.title}
        onClick={() => onChange(it.key)}
        className={`px-[8px] ${dense ? 'py-[3px]' : 'py-[4px]'} font-mono text-[11px] tracking-[0.03em] uppercase whitespace-nowrap transition disabled:opacity-40 disabled:pointer-events-none ${
          it.key === value ? 'bg-ink text-on-ink font-bold' : 'text-ink-soft hover:text-ink'
        }`}
      >
        {it.label}
      </button>
    ))}
  </div>
);

// ---------- Поля ----------

export const FieldLabel = ({ children, right, error = false, className = '' }) => (
  <div className={`flex items-start justify-between gap-3 ${className}`}>
    <span className={`font-mono font-medium text-[11px] tracking-[0.06em] uppercase ${error ? 'text-accent' : 'text-ink-soft'}`}>{children}</span>
    {right && <span className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft">{right}</span>}
  </div>
);

/**
 * Поле формы: подпись, ввод с пунктиром снизу, подсказка. mono — для чисел и дат.
 * error — строка ошибки (красная сплошная черта и подпись), active — сплошная чёрная черта.
 */
export const Field = ({ label, right, hint, error, active = false, mono = false, multiline = false, suffix, className = '', inputClassName = '', ...props }) => {
  const base = `w-full bg-transparent outline-none text-[16px] text-ink placeholder:text-ink-faint ${mono ? 'font-mono tracking-[0.02em]' : ''} ${inputClassName}`;
  const line = error ? 'border-solid border-accent' : active ? 'border-solid border-ink' : 'border-dashed border-line focus-within:border-ink';
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <FieldLabel right={right} error={!!error}>{label}</FieldLabel>
      <div className={`flex items-center gap-2 border-b pb-[10px] ${line}`}>
        {multiline ? (
          <textarea rows={2} className={`${base} resize-none leading-[1.5]`} {...props} />
        ) : (
          <input className={base} {...props} />
        )}
        {suffix}
      </div>
      {error ? (
        <div className="font-mono font-medium text-[12px] leading-[18px] uppercase text-accent">{error}</div>
      ) : (
        hint && <div className="text-[12px] leading-[18px] text-ink-soft">{hint}</div>
      )}
    </label>
  );
};

// ---------- Данные ----------

/** Четыре показателя в ряд, разделённые пунктирными вертикалями. */
export const StatRow = ({ items, compact = false, tight = false }) => (
  <div className={`flex items-start flex-wrap lg:flex-nowrap ${tight ? 'gap-4' : 'gap-6'}`}>
    {items.map((s, i) => (
      <React.Fragment key={i}>
        {i > 0 && <VRule className="hidden lg:block" />}
        <div className={`flex-1 ${tight ? 'min-w-[90px]' : 'min-w-[180px]'} flex flex-col gap-[6px] whitespace-nowrap`}>
          <div className="font-mono font-medium text-[10px] tracking-[0.06em] uppercase text-ink-soft">{s.label}</div>
          <div className={`font-display font-bold ${tight ? 'text-[22px]' : compact ? 'text-[24px]' : 'text-[28px]'} tracking-[-0.01em] text-ink leading-[1.25]`}>{s.value}</div>
          {s.caption && <div className="font-mono text-[11px] tracking-[0.02em] text-ink-soft uppercase">{s.caption}</div>}
        </div>
      </React.Fragment>
    ))}
  </div>
);

/** Столбики «по дням»: пунктирные, последний (сегодня) — залитый. */
export const DayBars = ({ days, height = 120 }) => {
  const max = Math.max(1, ...days.map((d) => d.count));
  const marks = days.length > 1 ? [0, 0.25, 0.5, 0.75, 1].map((f) => days[Math.round(f * (days.length - 1))]) : days;
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {days.map((d, i) => {
          const last = i === days.length - 1;
          const h = d.count === 0 ? 2 : Math.max(6, Math.round((d.count / max) * height));
          return (
            <div
              key={d.date}
              title={`${ddmm(d.date)} · ${d.count}`}
              className={`flex-1 min-w-px ${last ? 'bg-ink' : 'border border-dashed border-ink'}`}
              style={{ height: h }}
            />
          );
        })}
      </div>
      <div className="mt-5 flex justify-between font-mono text-[10px] tracking-[0.02em] text-ink-soft">
        {marks.map((d, i) => (
          <span key={i}>{ddmm(d.date)}</span>
        ))}
      </div>
    </div>
  );
};

/**
 * Таблица: шапка с жирной чертой, строки через пунктир.
 * columns: [{key, label, width, align, render}]
 */
export const Table = ({ columns, rows, rowKey = 'id', empty = 'Пока пусто', footer, minWidth = 0 }) => (
  <div className="w-full overflow-x-auto">
    <div style={{ minWidth }}>
      <div className="flex items-center gap-4 py-2 border-b border-ink">
        {columns.map((c) => (
          <div
            key={c.key}
            className={`font-mono font-medium text-[10px] tracking-[0.06em] uppercase text-ink-soft ${c.width ? 'shrink-0' : 'flex-1 min-w-0'} ${c.align === 'right' ? 'text-right' : ''}`}
            style={c.width ? { width: c.width } : undefined}
          >
            {c.label}
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="py-6 text-[14px] text-ink-soft border-b border-dashed border-line">{empty}</div>
      ) : (
        rows.map((r, i) => (
          <div key={r[rowKey] ?? i} className="flex items-center gap-4 py-3 border-b border-dashed border-line">
            {columns.map((c) => (
              <div
                key={c.key}
                className={`${c.width ? 'shrink-0' : 'flex-1 min-w-0'} ${c.align === 'right' ? 'text-right' : ''}`}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.render ? c.render(r) : r[c.key]}
              </div>
            ))}
          </div>
        ))
      )}
      {footer}
    </div>
  </div>
);

export const CellMono = ({ children, className = '' }) => (
  <span className={`font-mono text-[12px] tracking-[0.02em] uppercase text-ink ${className}`}>{children}</span>
);
export const CellText = ({ children, className = '' }) => (
  <span className={`block text-[14px] font-medium tracking-[0.02em] text-ink truncate ${className}`}>{children}</span>
);

/** Статус со значком: ● ◐ ↺ ✕ ○ ▫ */
export const StatusMark = ({ kind, children, className = '' }) => {
  const icons = { ok: '●', progress: '◐', back: '↺', reject: '✕', draft: '○', archive: '▫' };
  const tone = kind === 'draft' || kind === 'archive' ? 'text-ink-soft' : 'text-ink';
  return (
    <span className={`font-mono font-medium text-[11px] tracking-[0.03em] uppercase whitespace-nowrap ${tone} ${className}`}>
      {icons[kind] || '●'} {children}
    </span>
  );
};

/** Чёрная плашка-предупреждение (касса). */
export const AlertBlock = ({ title, children, className = '' }) => (
  <div className={`bg-ink px-4 py-[14px] flex flex-col gap-1 ${className}`}>
    <div className="font-mono font-bold text-[12px] tracking-[0.04em] uppercase text-on-ink">! {title}</div>
    {children && <div className="text-[14px] leading-[20px] text-plate-soft">{children}</div>}
  </div>
);

/** Блок «требует внимания»: слева жирная черта. */
export const NoteBlock = ({ title, children, action }) => (
  <div className="border-l-[3px] border-ink pl-[14px] flex flex-col gap-2 items-start">
    <div className="font-mono font-bold text-[11px] tracking-[0.04em] text-ink uppercase">{title}</div>
    <div className="text-[14px] leading-[21px] text-ink">{children}</div>
    {action}
  </div>
);

/** Строка «ПОДПИСЬ ....... ЗНАЧЕНИЕ» в размерах кабинета. */
export const Leader = ({ label, value, strong = false, soft = false, big = false, className = '' }) => (
  <div className={`flex items-end gap-2 ${className}`}>
    <span className={`font-mono text-[12px] tracking-[0.03em] uppercase whitespace-nowrap ${strong ? 'font-bold' : ''} ${soft ? 'text-ink-soft' : 'text-ink'}`}>
      {label}
    </span>
    <span className={`flex-1 min-w-[8px] border-t border-dashed border-ink-faint ${big ? 'h-[9px]' : 'h-[4px]'}`} />
    <span
      className={`whitespace-nowrap ${big ? 'font-display font-bold text-[26px] tracking-[0.01em] leading-none' : 'font-mono text-[12px] tracking-[0.01em]'} ${soft ? 'text-ink-soft' : 'text-ink'} ${strong && !big ? 'font-bold' : ''}`}
    >
      {value}
    </span>
  </div>
);

// Уменьшенная копия загруженной картинки: сервер отдаёт /uploads/x.jpg?w=N
// (N — короткая сторона в пикселях), вместо оригинала на несколько мегабайт.
const THUMB_WIDTHS = [64, 128, 256, 512, 1024];
export const thumb = (src, px) => {
  if (!src || !src.startsWith('/uploads/') || src.includes('?')) return src;
  const w = THUMB_WIDTHS.find((x) => x >= px) || 1024;
  return `${src}?w=${w}`;
};

export const Avatar = ({ src, name, size = 28 }) =>
  src ? (
    <img
      src={thumb(src, size * Math.min(3, Math.ceil(window.devicePixelRatio || 2)))}
      alt=""
      loading="lazy"
      decoding="async"
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-mono font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: 'linear-gradient(135deg, #2a2a1f 14%, #8c8456 57%, #e6e0b8 86%)' }}
    >
      {(name || '?').trim()[0]?.toUpperCase()}
    </div>
  );

export const Photo = ({ src, className = '', children }) =>
  src ? (
    <div className={`relative bg-cover bg-center bg-surface-2 ${className}`} style={{ backgroundImage: `url('${thumb(src, 1024)}')` }}>
      {children}
    </div>
  ) : (
    <div className={`relative bg-surface-2 ${className}`}>{children}</div>
  );

export const Loading = ({ label = 'Загрузка…' }) => (
  <div className="py-16 font-mono text-[12px] tracking-[0.06em] uppercase text-ink-soft">{label}</div>
);

export const ErrorLine = ({ children }) =>
  children ? <div className="font-mono text-[12px] tracking-[0.02em] text-accent">{children}</div> : null;

// ---------- Транзакции ----------

export const txOperation = (t, { long = false } = {}) => {
  const no = t.order_id ? `№ ${pad6(t.order_id)}` : '';
  switch (t.type) {
    case 'order_earning':
      return long ? `Заказ · ${(t.offer_title || '').toLowerCase()}` : `Заказ ${no} · ${t.company_name}`;
    case 'refund':
      return long ? `Возврат · ${(t.offer_title || 'заказ').toLowerCase()}` : `Возврат ${no} · ${t.company_name}`;
    case 'settlement':
      return 'Выплата на расчётный счёт';
    default:
      return t.description || 'Корректировка';
  }
};

export const txStatus = (t) => {
  if (t.type === 'refund') return <StatusMark kind="back">Возврат</StatusMark>;
  if (t.status === 'pending') return <StatusMark kind="progress">В обработке</StatusMark>;
  if (t.status === 'failed') return <StatusMark kind="reject">Ошибка</StatusMark>;
  if (t.type === 'settlement') return <StatusMark kind="ok">Выплачено</StatusMark>;
  return <StatusMark kind="ok">Зачислено</StatusMark>;
};

export const greeting = (d = new Date()) => {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 17) return 'Добрый день';
  if (h >= 17 && h < 23) return 'Добрый вечер';
  return 'Доброй ночи';
};

export const joinNames = (names) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`;

/** Декоративный штрихкод (не для сканирования): полосы 1–3 px из seed. */
export const Barcode = ({ seed = 1, width = 240, height = 26, className = '' }) => {
  const { rects, total } = React.useMemo(() => {
    let x = (Number(seed) * 2654435761) >>> 0;
    const out = [];
    let pos = 0;
    for (let i = 0; i < 70; i++) {
      x = (x * 1103515245 + 12345) >>> 0;
      const w = 1 + (x % 3);
      if (i % 2 === 0) out.push({ x: pos, w });
      pos += w;
    }
    return { rects: out, total: pos };
  }, [seed]);
  return (
    <svg viewBox={`0 0 ${total} ${height}`} preserveAspectRatio="none" style={{ width, height }} className={className} shapeRendering="crispEdges" aria-hidden="true">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y="0" width={r.w} height={height} fill="currentColor" />
      ))}
    </svg>
  );
};
