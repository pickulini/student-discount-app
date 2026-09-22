import React from 'react';
import { Button } from './UI';

/** Горизонтальный пунктирный разделитель — сквозной мотив приложения. */
export const DottedDivider = ({ className = '', accent = false, style }) => (
  <div
    className={`dotted-divider ${accent ? 'dotted-divider--accent' : ''} ${className}`}
    style={style}
  />
);

/** Вертикальный пунктирный разделитель — между карточками в ряд/колонку. */
export const DottedDividerV = ({ className = '', accent = false, style }) => (
  <div
    className={`dotted-divider-v ${accent ? 'dotted-divider--accent' : ''} ${className}`}
    style={style}
  />
);

/** Логотип-метафора: точка (студент) — пунктир (путь) — точка (место/событие). */
export const RouteMark = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`}>
    <span className="w-2 h-2 rounded-full bg-accent" />
    {Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className="w-1 h-1 rounded-full bg-ink-soft" />
    ))}
    <span className="w-2 h-2 rounded-full border border-accent" />
  </span>
);

/** Лёгкий индикатор загрузки на основе того же мотива. */
export const RouteLoadingIndicator = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <span
        key={i}
        className="route-loading-dot w-1.5 h-1.5 rounded-full bg-accent"
        style={{ animationDelay: `${i * 0.12}s` }}
      />
    ))}
  </span>
);

/** Полноэкранное состояние загрузки. */
export const RouteLoadingView = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-4 py-24">
    <RouteMark />
    <RouteLoadingIndicator />
    {label && <div className="text-sm text-ink-soft">{label}</div>}
  </div>
);

/** Тихое пустое состояние, с пунктиром сверху и снизу. */
export const RouteEmptyState = ({ title, subtitle, action }) => (
  <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-8">
    <DottedDivider className="w-24" />
    <div className="text-ink font-medium">{title}</div>
    {subtitle && <div className="text-sm text-ink-soft max-w-sm">{subtitle}</div>}
    <DottedDivider className="w-24" />
    {action}
  </div>
);

/** Состояние ошибки с возможностью повторить. */
export const RouteErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-20 text-center px-8">
    <div className="text-ink font-medium">Что-то пошло не так</div>
    {message && <div className="text-sm text-ink-soft max-w-sm">{message}</div>}
    {onRetry && (
      <Button variant="ghost" onClick={onRetry} className="mt-2 px-6">
        Повторить
      </Button>
    )}
  </div>
);
