import React, { createContext, useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * Мобильная «шапка» страницы (макет «Студент · mobile»): на вкладках —
 * логотип и вуз, на внутренних экранах — строка «← НАЗАД» с действием справа.
 * Страница задаёт её через useMobileTop({ back, label, right }).
 */

const Ctx = createContext({ top: null, setTop: () => {} });

export const MobileChromeProvider = ({ children }) => {
  const [top, setTop] = useState(null);
  return <Ctx.Provider value={{ top, setTop }}>{children}</Ctx.Provider>;
};

export const useMobileChrome = () => useContext(Ctx);

/** back — куда вести (строка-путь или -1), label — подпись после стрелки, right — узел справа. */
export const useMobileTop = (cfg, deps = []) => {
  const { setTop } = useContext(Ctx);
  useEffect(() => {
    setTop(cfg);
    return () => setTop(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

export const MobileBackRow = ({ back = -1, label = 'Назад', mark = '←', right, onBack }) => {
  const navigate = useNavigate();
  const cls = 'font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink whitespace-nowrap';
  return (
    <div className="flex items-center justify-between gap-4 min-h-[16px]">
      {onBack ? (
        <button type="button" onClick={onBack} className={cls}>
          {mark} {label}
        </button>
      ) : typeof back === 'string' ? (
        <Link to={back} className={cls}>
          {mark} {label}
        </Link>
      ) : (
        <button type="button" onClick={() => (window.history.length > 1 ? navigate(back) : navigate('/'))} className={cls}>
          {mark} {label}
        </button>
      )}
      {right}
    </div>
  );
};
