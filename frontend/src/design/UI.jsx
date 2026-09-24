import React from 'react';

/**
 * Единая дизайн-система сайта — визуальный язык кассового чека
 * (см. Figma «Концепция «Чек», 00 · Основы»): белая бумага, чёрная
 * краска, никаких рамок/теней/скруглений. Структуру держат пунктир,
 * двойная черта и строки с отточием. Красный — только текстом, точечно.
 */

const base =
  'inline-flex items-center justify-center gap-2 font-mono font-bold uppercase tracking-[0.06em] transition disabled:opacity-40 disabled:pointer-events-none px-5 py-3.5 text-xs';

export const Button = ({ variant = 'primary', className = '', children, ...props }) => {
  const variants = {
    // Главное действие — чёрная плашка, как инверсная печать на кассе.
    primary: 'bg-ink text-on-ink hover:bg-ink/85',
    ghost: 'bg-transparent text-ink border border-ink hover:bg-surface-2',
    danger: 'bg-transparent text-accent hover:bg-accent/5',
    // Второстепенное действие — текст в скобках, без плашки.
    link: 'bg-transparent text-ink px-0 py-1.5 normal-case font-medium tracking-[0.04em] btn-bracket',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input = React.forwardRef(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full bg-transparent border-b border-line focus:border-ink outline-none py-2.5 text-ink placeholder:text-ink-faint transition ${className}`}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef(({ className = '', ...props }, ref) => (
  <textarea
    ref={ref}
    className={`w-full bg-surface-2 border-none outline-none px-3 py-2.5 text-ink placeholder:text-ink-faint transition ${className}`}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

/** Без рамки/тени/скругления — просто блок бумаги. Разделение — через rule-dashed/rule-double. */
export const Card = ({ className = '', children, ...props }) => (
  <div className={`bg-surface ${className}`} {...props}>
    {children}
  </div>
);

export const Label = ({ children, className = '' }) => (
  <div className={`text-xs uppercase tracking-wide text-ink-soft font-semibold ${className}`}>
    {children}
  </div>
);

/** Мелкий uppercase mono-лейбл для заголовков секций ленты. */
export const Eyebrow = ({ children, className = '' }) => (
  <div className={`text-eyebrow ${className}`}>{children}</div>
);

/** Техническая подпись — метраж, время, счётчики: mono, приглушённая. */
export const Caption = ({ children, className = '' }) => (
  <div className={`text-caption text-xs text-ink-faint ${className}`}>{children}</div>
);

/** Статус/тег. filled — залито чёрным (редко); по умолчанию — просто mono-текст в рамке. */
export const Badge = ({ children, filled = false, danger = false, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono uppercase tracking-[0.04em] ${
      filled
        ? 'bg-ink text-on-ink'
        : danger
        ? 'text-accent border border-accent/40'
        : 'text-ink-soft border border-line'
    } ${className}`}
  >
    {children}
  </span>
);

export const PageTitle = ({ children, className = '' }) => (
  <h1 className={`text-editorial text-3xl text-ink mb-6 ${className}`}>{children}</h1>
);

export const ErrorText = ({ children }) =>
  children ? <div className="text-sm text-accent mb-3">{children}</div> : null;

/** Строка "ЦЕНА ....... 300 ₽" — mono-подпись слева, пунктирное отточие, значение справа. */
export const LeaderRow = ({ label, value, className = '', valueClassName = '' }) => (
  <div className={`leader-row ${className}`}>
    <span className="leader-row__label">{label}</span>
    <span className="leader-row__fill" />
    <span className={`leader-row__value ${valueClassName}`}>{value}</span>
  </div>
);
