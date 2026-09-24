import React from 'react';
import { Rule2, Segmented, hhmm } from '../merchant/kit';

/** Шапка панели настроек: заголовок 32px, подзаголовок и двойная черта. */
export const PanelHead = ({ title, subtitle }) => (
  <>
    <div className="flex flex-col gap-2">
      <h2 className="font-display font-bold text-[28px] sm:text-[32px] leading-none tracking-[-0.02em] text-ink uppercase">{title}</h2>
      {subtitle && <p className="text-[16px] leading-[24px] text-ink-soft">{subtitle}</p>}
    </div>
    <Rule2 />
  </>
);

/** Строка настройки: подпись и пояснение слева, переключатель справа. */
export const SettingRow = ({ title, hint, children, dim = false }) => (
  <div className={`flex gap-6 items-center transition ${dim ? 'opacity-40' : ''}`}>
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <span className="font-mono font-bold text-[12px] tracking-[0.04em] uppercase text-ink">{title}</span>
      {hint && <span className="text-[14px] leading-[20px] text-ink-soft">{hint}</span>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

export const OnOff = ({ value, onChange, disabled = false }) => (
  <Segmented
    dense
    value={value}
    onChange={onChange}
    items={[
      { key: true, label: 'Вкл', disabled },
      { key: false, label: 'Выкл', disabled },
    ]}
  />
);

/** «✓ ПРОФИЛЬ ОБНОВЛЁН · 00:52» после сохранения. */
export const SavedMark = ({ at, children }) =>
  at ? (
    <span className="font-mono font-bold text-[11px] tracking-[0.04em] uppercase text-ink whitespace-nowrap">
      ✓ {children} · {hhmm(at)}
    </span>
  ) : null;

export const ErrorText = ({ children }) =>
  children ? <span className="font-mono font-medium text-[12px] tracking-[0.02em] uppercase text-accent">{children}</span> : null;
