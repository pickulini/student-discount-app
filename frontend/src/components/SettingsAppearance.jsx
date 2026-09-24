import React, { useState } from 'react';
import { Rule2, Segmented } from './merchant/kit';
import { PanelHead, SettingRow } from './settings/shared';
import { getThemePref, setThemePref } from '../utils/theme';

/**
 * D65 · Настройки → Оформление: тема и язык.
 * Превью нарисованы фиксированными цветами обеих тем — они не должны меняться вместе с темой.
 */

const LIGHT = { bg: '#ffffff', ink: '#121212', accent: '#d12b1f', leader: '#a8a8a8' };
const DARK = { bg: '#17140f', ink: '#ece1c8', accent: '#f2674f', leader: '#4b4335' };

const MiniRule = ({ color }) => <div className="h-[5px] w-full border-y border-dashed" style={{ borderColor: color }} />;

const MiniLeader = ({ label, value, c, accent = false }) => (
  <div className="flex items-end gap-2 w-full">
    <span className="font-mono text-[11px] tracking-[0.03em] uppercase whitespace-nowrap" style={{ color: c.ink }}>{label}</span>
    <span className="flex-1 min-w-[8px] h-[4px] border-t border-dashed" style={{ borderColor: c.leader }} />
    <span className={`font-mono text-[11px] tracking-[0.01em] whitespace-nowrap ${accent ? 'font-bold' : ''}`} style={{ color: accent ? c.accent : c.ink }}>
      {value}
    </span>
  </div>
);

const Receipt = ({ c }) => (
  <div className="flex flex-col gap-[10px] p-[18px] w-full" style={{ background: c.bg }}>
    <span className="font-display font-bold text-[13px] tracking-[-0.01em] whitespace-nowrap" style={{ color: c.ink }}>СТУДЕНТ−%</span>
    <MiniRule color={c.ink} />
    <MiniLeader label="Coffee Point" value="−20%" c={c} accent />
    <MiniLeader label="Итого" value="210 ₽" c={c} />
  </div>
);

const Half = ({ c }) => (
  <div className="flex-1 min-w-0 flex flex-col gap-[10px] px-3 py-[18px]" style={{ background: c.bg }}>
    <span className="font-display font-bold text-[13px] whitespace-nowrap" style={{ color: c.ink }}>СТ−%</span>
    <MiniRule color={c.ink} />
    <span className="font-mono font-bold text-[11px]" style={{ color: c.accent }}>−20%</span>
    <span className="font-mono text-[11px]" style={{ color: c.ink }}>210 ₽</span>
  </div>
);

const OPTIONS = [
  { key: 'auto', label: 'Авто · как в системе', preview: <div className="flex w-full"><Half c={LIGHT} /><Half c={DARK} /></div> },
  { key: 'light', label: 'Светлая', preview: <Receipt c={LIGHT} /> },
  { key: 'dark', label: 'Тёмная', preview: <Receipt c={DARK} /> },
];

const SettingsAppearance = () => {
  const [theme, setTheme] = useState(getThemePref);

  const pick = (key) => {
    setTheme(key);
    setThemePref(key);
  };

  return (
    <>
      <PanelHead title="Оформление" subtitle="Тема по умолчанию следует за настройкой системы." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6" role="radiogroup" aria-label="Тема">
        {OPTIONS.map((o) => {
          const on = theme === o.key;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(o.key)}
              className="flex flex-col gap-3 items-start text-left group"
            >
              <div
                className={`w-full overflow-hidden ${on ? 'border-2 border-solid border-ink' : 'border border-dashed border-line group-hover:border-ink-faint'}`}
              >
                {o.preview}
              </div>
              <span className="flex gap-[10px] items-start whitespace-nowrap">
                <span className={`font-mono font-bold text-[13px] ${on ? 'text-ink' : 'text-ink-faint'}`}>{on ? '[×]' : '[ ]'}</span>
                <span className={`font-mono text-[12px] tracking-[0.04em] uppercase ${on ? 'font-bold text-ink' : 'text-ink-soft group-hover:text-ink'}`}>
                  {o.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Rule2 />

      <SettingRow title="Язык" hint="Интерфейс и уведомления">
        <Segmented
          dense
          value="ru"
          onChange={() => {}}
          items={[
            { key: 'ru', label: 'Русский' },
            { key: 'en', label: 'English', disabled: true, title: 'Английская версия пока готовится' },
          ]}
        />
      </SettingRow>
    </>
  );
};

export default SettingsAppearance;
