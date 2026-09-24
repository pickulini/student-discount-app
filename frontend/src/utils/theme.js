/**
 * Тема оформления: 'auto' | 'light' | 'dark'. Храним выбор в localStorage,
 * на <html> ставим data-theme="light|dark" — по нему переключаются цвета.
 */
const KEY = 'theme';

export const getThemePref = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
};

const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

export const resolveTheme = (pref = getThemePref()) => (pref === 'auto' ? (media()?.matches ? 'dark' : 'light') : pref);

export const applyTheme = (pref = getThemePref()) => {
  const theme = resolveTheme(pref);
  document.documentElement.dataset.theme = theme;
  // Цвет строки состояния браузера на телефоне — под фон темы.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#17140f' : '#ffffff';
};

export const setThemePref = (pref) => {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* приватный режим — просто не запоминаем */
  }
  applyTheme(pref);
};

/** Следить за системной темой, пока выбрано «Авто». */
export const watchSystemTheme = () => {
  const m = media();
  if (!m) return () => {};
  const on = () => getThemePref() === 'auto' && applyTheme('auto');
  m.addEventListener?.('change', on);
  return () => m.removeEventListener?.('change', on);
};
