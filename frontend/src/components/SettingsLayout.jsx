import React from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Rule, Rule2, VRule } from './merchant/kit';

/** D60–D65 · Настройки: слева меню разделов, справа панель раздела. */

const verificationHint = (user) => {
  if (user?.student_status === 'verified') return 'Статус студента ✓';
  if (user?.student_status === 'pending') return 'Заявка на проверке';
  return 'Статус студента';
};

const SettingsLayout = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!user) return <div className="text-center py-8 text-ink-soft">Требуется авторизация</div>;

  const nav = [
    { to: '/settings/profile', label: 'Профиль', hint: 'Никнейм, username, аватар' },
    { to: '/verification', label: 'Верификация', hint: verificationHint(user) },
    { to: '/settings/privacy', label: 'Приватность', hint: 'Кто видит ваш профиль' },
    { to: '/settings/notifications', label: 'Уведомления', hint: 'Что вам присылать' },
    { to: '/settings/security', label: 'Безопасность', hint: 'Пароль и сессии' },
    { to: '/settings/account', label: 'Аккаунт', hint: 'Данные и удаление' },
    { to: '/settings/appearance', label: 'Оформление', hint: 'Тема и язык' },
  ];
  const current = nav.find((n) => pathname.startsWith(n.to)) || nav[0];

  return (
    <div className="flex flex-col gap-8">
      <div className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft whitespace-pre">
        <Link to="/profile" className="hover:text-ink">Профиль</Link>
        {'  /  '}
        <Link to="/settings/profile" className="hover:text-ink">Настройки</Link>
        {'  /  '}
        {current.label}
      </div>

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
        <nav className="w-full lg:w-[300px] shrink-0 flex flex-col gap-[14px]">
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
