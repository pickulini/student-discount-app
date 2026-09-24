import React from 'react';
import { Button } from './UI';

/**
 * Разделители и служебные состояния — язык кассового чека
 * (Figma «Концепция «Чек», 00 · Основы», раздел «03 · Разделители»).
 * Рамок нет — только пунктир, двойная черта, отточие и зубчатый отрыв.
 */

/** - - - - пунктир: между элементами одного раздела (предложение и предложение). */
export const RuleDashed = ({ className = '', style }) => (
  <hr className={`rule-dashed ${className}`} style={style} />
);

/** ========= двойная: между разделами и перед итогом. Самый сильный разделитель. */
export const RuleDouble = ({ className = '', style }) => (
  <hr className={`rule-double ${className}`} style={style} />
);

/** Вертикальный пунктир — между карточками в ряд (горизонтальные секции). */
export const RuleDashedV = ({ className = '', style }) => (
  <div
    className={`w-px self-stretch ${className}`}
    style={{ borderLeft: '1px dashed var(--color-line)', ...style }}
  />
);

/** /\/\/\ отрыв — зубчатый край, только в конце ленты или чека, один раз на экран. */
export const TearEdge = ({ className = '' }) => <div className={`tear-edge ${className}`} />;

/* --- Обратная совместимость со старыми именами (тот же приём, новая заливка). --- */
export const DottedDivider = RuleDashed;
export const DottedDividerV = RuleDashedV;
export const TrailDivider = RuleDashed;
export const TrailDividerV = RuleDashedV;

/** Логотип-метафора: точка (студент) — пунктир (путь) — точка (место/событие). */
export const RouteMark = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`}>
    <span className="w-1.5 h-1.5 rounded-full bg-ink" />
    {Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className="w-1 h-1 rounded-full bg-ink-faint" />
    ))}
    <span className="w-1.5 h-1.5 rounded-full border border-ink" />
  </span>
);

/** Лёгкий индикатор загрузки на основе того же мотива. */
export const RouteLoadingIndicator = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <span
        key={i}
        className="route-loading-dot w-1.5 h-1.5 rounded-full bg-ink"
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
    {label && <div className="text-sm text-ink-soft font-mono">{label}</div>}
  </div>
);

/** Тихое пустое состояние, с пунктиром сверху и снизу. */
export const RouteEmptyState = ({ title, subtitle, action }) => (
  <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-8">
    <RuleDashed className="w-24" />
    <div className="text-ink font-medium">{title}</div>
    {subtitle && <div className="text-sm text-ink-soft max-w-sm">{subtitle}</div>}
    <RuleDashed className="w-24" />
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
