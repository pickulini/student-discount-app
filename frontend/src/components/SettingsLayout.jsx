import React, { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMobileTop } from '../context/MobileChrome';
import { Rule, Rule2, VRule, Segmented } from './merchant/kit';
import { getThemePref, setThemePref } from '../utils/theme';

export const APP_VERSION = '0.9 · 24.09.26';

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 768px)').matches;

/** /settings: на компьютере сразу открываем «Профиль», на телефоне — список разделов (макет 60). */
export const SettingsIndex = () => (isDesktop() ? <Navigate to="/settings/profile" replace /> : null);

/** Блок «Оформление» прямо в списке настроек на телефоне. */
const ThemeInline = () => {
  const [theme, setTheme] = useState(getThemePref);
  return (
    <div className="flex gap-4 items-center">
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="font-mono font-bold text-[12px] tracking-[0.04em] uppercase text-ink">Тема</span>
        <span className="text-[13px] leading-[19px] text-ink-soft">По умолчанию — как в системе телефона</span>
      </div>
      <Segmented
        dense
        value={theme}
        onChange={(k) => {
          setTheme(k);
          setThemePref(k);
        }}
        items={[
          { key: 'auto', label: 'Авто' },
          { key: 'light', label: 'Светлая' },
          { key: 'dark', label: 'Тёмная' },
        ]}
      />
    </div>
  );
};

/** D60–D65 · Настройки: слева меню разделов, справа панель раздела. */

const verificationHint = (user) => {
  if (user?.student_status === 'verified') return 'Статус студента ✓';
  if (user?.student_status === 'pending') return 'Заявка на проверке';
  return 'Статус студента';
};

const SettingsLayout = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const atIndex = /^\/settings\/?$/.test(pathname);
  useMobileTop(atIndex ? { back: '/profile', label: 'Профиль' } : { back: '/settings', label: 'Настройки' }, [atIndex]);

  if (!user) return <div className="text-center py-8 text-ink-soft">Требуется авторизация</div>;

  const nav = [
    { to: '/settings/profile', label: 'Профиль', hint: 'Никнейм, username, аватар' },
    { to: '/verification', label: 'Верификация', hint: verificationHint(user), mobileHint: user?.student_status === 'pending' ? 'Заявка на проверке' : 'Статус студента' },
    { to: '/settings/privacy', label: 'Приватность', hint: 'Кто видит ваш профиль' },
    { to: '/settings/notifications', label: 'Уведомления', hint: 'Что вам присылать' },
    { to: '/settings/security', label: 'Безопасность', hint: 'Пароль и сессии', mobileHint: 'Пароль и активные сессии' },
    { to: '/settings/account', label: 'Аккаунт', hint: 'Данные и удаление', mobileHint: 'Баланс, рефералы, удаление' },
    { to: '/settings/appearance', label: 'Оформление', hint: 'Тема и язык' },
  ];
  const current = nav.find((n) => pathname.startsWith(n.to)) || nav[0];
  const isIndex = /^\/settings\/?$/.test(pathname);

  return (
    <div className="flex flex-col gap-8">
      {isIndex && (
        <div className="md:hidden flex flex-col gap-5">
          <h1 className="font-display font-bold text-[34px] leading-none tracking-[-0.02em] text-ink">НАСТРОЙКИ</h1>
          <Rule2 />
          <nav className="flex flex-col -my-1">
            {nav
              .filter((n) => n.to !== '/settings/appearance')
              .map((n, i) => (
                <React.Fragment key={n.to}>
                  {i > 0 && <Rule />}
                  <Link to={n.to} className="py-[14px] flex items-center justify-between gap-3">
                    <span className="min-w-0 flex flex-col gap-[4px]">
                      <span className="font-mono font-bold text-[12px] tracking-[0.04em] uppercase text-ink">{n.label}</span>
                      <span className="text-[13px] text-ink-soft">{n.mobileHint || n.hint}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0 text-ink">
                      {n.to === '/verification' && user.student_status === 'verified' && <span className="text-[15px]">✓</span>}
                      <span className="font-mono text-[13px]">→</span>
                    </span>
                  </Link>
                </React.Fragment>
              ))}
          </nav>
          <Rule2 />
          <span className="font-mono font-medium text-[11px] tracking-[0.08em] uppercase text-ink">Оформление</span>
          <ThemeInline />
          <Rule />
          <div className="text-center font-mono text-[11px] tracking-[0.04em] text-ink-faint uppercase">Версия {APP_VERSION}</div>
        </div>
      )}
      <div className="hidden md:block font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft whitespace-pre">
        <Link to="/profile" className="hover:text-ink">Профиль</Link>
        {'  /  '}
        <Link to="/settings/profile" className="hover:text-ink">Настройки</Link>
        {'  /  '}
        {current.label}
      </div>

      <div className={`${isIndex ? 'hidden md:flex' : 'flex'} flex-col lg:flex-row gap-10 lg:gap-14 items-start`}>
        <nav className="hidden md:flex w-full lg:w-[300px] shrink-0 flex-col gap-[14px]">
          <h1 className="font-display font-bold text-[26px] leading-none tracking-[-0.02em] text-ink">НАСТРОЙКИ</h1>
          <Rule2 />
          {nav.map((n, i) => (
            <React.Fragment key={n.to}>
              {i > 0 && <Rule />}
              <NavLink
                to={n.to}
                className={({ isActive }) =>
                  `flex flex-col gap-[3px] whitespace-nowrap group ${isActive ? 'border-l-[3px] border-ink pl-[14px]' : ''}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`font-mono text-[12px] tracking-[0.04em] uppercase ${
                        isActive ? 'font-bold text-ink' : 'text-ink-soft group-hover:text-ink'
                      }`}
                    >
                      {n.label}
                    </span>
                    <span className="text-[13px] text-ink-soft">{n.hint}</span>
                  </>
                )}
              </NavLink>
            </React.Fragment>
          ))}
        </nav>

        <VRule className="hidden lg:block" />

        <main className="w-full lg:max-w-[720px] flex-1 min-w-0 flex flex-col gap-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SettingsLayout;
