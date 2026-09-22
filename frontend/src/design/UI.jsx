import React from 'react';

/**
 * Единая дизайн-система сайта — тот же язык, что в iOS-приложении:
 * тёмный, редакторский, urban discovery, а не маркетплейс. Прямые линии,
 * минимум скруглений, лайм — точечно.
 */

const base =
  'inline-flex items-center justify-center gap-2 font-medium transition disabled:opacity-50 disabled:pointer-events-none rounded-[var(--radius-sm)] px-5 py-2.5 text-sm';

export const Button = ({ variant = 'primary', className = '', children, ...props }) => {
  const variants = {
    primary: 'bg-accent text-accent-ink hover:bg-accent/90',
    ghost: 'bg-surface-2 text-ink border border-line hover:border-ink-faint',
    danger: 'bg-transparent text-danger hover:bg-danger/10',
    link: 'bg-transparent text-ink-soft hover:text-ink px-0 py-0',
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
    className={`w-full bg-transparent border-b border-line focus:border-accent outline-none py-2.5 text-ink placeholder:text-ink-faint transition ${className}`}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef(({ className = '', ...props }, ref) => (
  <textarea
    ref={ref}
    className={`w-full bg-surface border border-line focus:border-accent outline-none rounded-[var(--radius-sm)] px-3 py-2.5 text-ink placeholder:text-ink-faint transition ${className}`}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Card = ({ className = '', children, ...props }) => (
  <div
    className={`bg-surface border border-line rounded-[var(--radius-md)] ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const Label = ({ children, className = '' }) => (
  <div className={`text-xs uppercase tracking-wide text-ink-soft font-semibold ${className}`}>
    {children}
  </div>
);

export const Badge = ({ children, filled = false, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-xs)] text-xs font-semibold ${
      filled ? 'bg-accent text-accent-ink' : 'border border-line text-ink-soft'
    } ${className}`}
  >
    {children}
  </span>
);

export const PageTitle = ({ children, className = '' }) => (
  <h1 className={`text-2xl font-semibold text-ink mb-6 ${className}`}>{children}</h1>
);

export const ErrorText = ({ children }) =>
  children ? <div className="text-sm text-danger mb-3">{children}</div> : null;
