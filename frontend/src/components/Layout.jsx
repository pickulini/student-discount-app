import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Avatar } from './merchant/kit';
import { MobileChromeProvider, MobileBackRow, useMobileChrome } from '../context/MobileChrome';

/**
 * Каркас студенческой части по макету «Концепция «Чек», Студент · desktop»:
 * верхняя строка (логотип · меню · «УВЕДОМЛЕНИЯ · N» · аватар «ИМЯ · ВУЗ ✓»),
 * двойная черта, содержимое, линия отрыва и подвал «СТУДЕНТ−% · 2026 · ЧЕК №».
 */

const NAV = [
  { to: '/', label: 'Предложения', match: (p) => p === '/' || p.startsWith('/offers') || p.startsWith('/orders') },
  { to: '/events', label: 'Ивенты', match: (p) => p.startsWith('/events') },
  { to: '/wallet', label: 'Кошелёк', match: (p) => p.startsWith('/wallet') || p.startsWith('/history') || p.startsWith('/referral') },
  { to: '/friends', label: 'Друзья', match: (p) => p.startsWith('/friends') || p.startsWith('/subscriptions') },
];

const MENU = [
  { to: '/profile', label: 'Профиль' },
  { to: '/order', label: 'Мои заказы' },
  { to: '/history', label: 'Журнал экономии' },
  { to: '/subscriptions', label: 'Подписки' },
  { to: '/referral', label: 'Рефералы' },
  { to: '/notifications', label: 'Уведомления' },
  { to: '/support', label: 'Поддержка' },
  { to: '/settings', label: 'Настройки' },
];

// Вкладки нижнего меню на телефоне.
const TABS = [
  { to: '/', label: 'Главная' },
  { to: '/events', label: 'Ивенты' },
  { to: '/wallet', label: 'Кошелёк' },
  { to: '/profile', label: 'Профиль' },
];
const isTabRoot = (p) => TABS.some((t) => t.to === p);

const Layout = () => (
  <MobileChromeProvider>
    <LayoutInner />
  </MobileChromeProvider>
);

const LayoutInner = () => {
  const { top } = useMobileChrome();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Чек заказа лежит на «столе» — у страницы тёплый серый фон (D03).
  const onDesk = /^\/orders\/\d+/.test(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  useEffect(() => setMenuOpen(false), [pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const firstName = (user?.nickname || (user?.full_name || '').split(' ')[0] || '').toUpperCase();
  const uni = user?.university_short || '';
  const verified = user?.student_status === 'verified';
  const checkNumber = String(user?.id || 0).padStart(6, '0');

  return (
    <div className={`min-h-screen flex flex-col text-ink ${onDesk ? 'bg-desk' : 'bg-bg'}`}>
      {/* Телефон: на вкладках — логотип и вуз, на внутренних экранах — «← назад». */}
      <div className="md:hidden px-5 pt-6">
        {isTabRoot(pathname) ? (
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="font-display font-bold text-[18px] tracking-[-0.02em] text-ink whitespace-nowrap">
              СТУДЕНТ−%
            </Link>
            {top?.tabRight ? (
              top.tabRight
            ) : user ? (
              <Link to="/profile" className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink whitespace-nowrap">
                {uni || firstName}
                {verified && ' ✓'}
              </Link>
            ) : (
              <Link to="/login" className="font-mono font-bold text-[11px] tracking-[0.06em] uppercase text-ink whitespace-nowrap">
                Войти
              </Link>
            )}
          </div>
        ) : top?.hidden ? null : (
          <MobileBackRow {...(top || {})} />
        )}
      </div>

      <header className={`hidden md:block ${onDesk ? 'bg-desk' : 'bg-bg'} sticky top-0 z-30`}>
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 xl:px-14 pt-5 sm:pt-7">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="font-display font-bold text-[20px] sm:text-[22px] tracking-[-0.02em] text-ink whitespace-nowrap">
              СТУДЕНТ−%
            </Link>

            {user && (
              <nav className="hidden md:flex items-start gap-9">
                {NAV.map((n) => {
                  const active = n.match(pathname);
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      className={`pb-1 font-mono text-[12px] tracking-[0.06em] uppercase whitespace-nowrap transition ${
                        active ? 'font-bold text-ink border-b border-ink' : 'text-ink-soft hover:text-ink border-b border-transparent'
                      }`}
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
            )}

            {user ? (
              <div className="flex items-center gap-6">
                <Link
                  to="/notifications"
                  className={`hidden sm:inline font-mono font-medium text-[11px] tracking-[0.04em] whitespace-nowrap hover:text-ink ${
                    unreadCount > 0 ? 'text-ink' : 'text-ink-soft'
                  }`}
                >
                  УВЕДОМЛЕНИЯ · {unreadCount > 99 ? '99+' : unreadCount}
                </Link>
                <div className="relative" ref={menuRef}>
                  <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-[10px]">
                    <Avatar src={user.avatar_url} name={firstName} size={28} />
                    <span className="hidden sm:inline font-mono font-medium text-[11px] tracking-[0.04em] text-ink whitespace-nowrap">
                      {firstName}
                      {uni && ` · ${uni}`}
                      {verified && ' ✓'}
                    </span>
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-3 w-[240px] bg-bg border border-dashed border-ink py-2 z-40">
                      <div className="md:hidden">
                        {NAV.map((n) => (
                          <Link key={n.to} to={n.to} className="block px-4 py-2 font-mono text-[11px] tracking-[0.04em] uppercase text-ink hover:bg-surface-2">
                            {n.label}
                          </Link>
                        ))}
                        <div className="my-2 border-t border-dashed border-line" />
                      </div>
                      {MENU.map((m) => (
                        <Link
                          key={m.to}
                          to={m.to}
                          className={`block px-4 py-2 font-mono text-[11px] tracking-[0.04em] uppercase hover:bg-surface-2 ${
                            pathname.startsWith(m.to) ? 'font-bold text-ink' : 'text-ink-soft'
                          }`}
                        >
                          {m.label}
                        </Link>
                      ))}
                      {user.username && (
                        <Link to={`/@${user.username}`} className="block px-4 py-2 font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft hover:bg-surface-2">
                          Публичный профиль
                        </Link>
                      )}
                      {(user.role === 'merchant' || user.role === 'admin') && <div className="my-2 border-t border-dashed border-line" />}
                      {user.role === 'merchant' && (
                        <Link to="/merchant" className="block px-4 py-2 font-mono font-bold text-[11px] tracking-[0.04em] uppercase text-ink hover:bg-surface-2">
                          Кабинет партнёра →
                        </Link>
                      )}
                      {user.role === 'admin' && (
                        <Link to="/admin" className="block px-4 py-2 font-mono font-bold text-[11px] tracking-[0.04em] uppercase text-ink hover:bg-surface-2">
                          Админка →
                        </Link>
                      )}
                      <div className="my-2 border-t border-dashed border-line" />
                      <button onClick={handleLogout} className="block w-full text-left px-4 py-2 font-mono text-[11px] tracking-[0.04em] uppercase text-accent hover:bg-surface-2">
                        Выйти
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <Link to="/login" className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink-soft hover:text-ink">
                  Вход
                </Link>
                <Link to="/register" className="bg-ink text-on-ink font-mono font-bold text-[11px] tracking-[0.04em] uppercase px-[10px] py-[6px] hover:bg-ink/85">
                  Регистрация
                </Link>
              </div>
            )}
          </div>
          <div className="mt-5 h-[5px] border-y border-dashed border-ink" />
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-5 md:px-8 xl:px-14 pt-5 md:pt-8">
        <Outlet />
      </main>

      {/* Телефон: линия отрыва и нижнее меню на вкладках. */}
      <div className="md:hidden px-5 pt-8 pb-6">
        <div className="tear-edge" />
      </div>
      {isTabRoot(pathname) && (
        <>
          <div className="md:hidden h-[64px]" />
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg px-5">
            <div className="border-t border-dashed border-ink pt-[14px] pb-[max(18px,env(safe-area-inset-bottom))] flex items-start justify-between">
              {TABS.map((t) => {
                const active = t.to === pathname;
                return (
                  <Link
                    key={t.to}
                    to={t.to}
                    className={`font-mono text-[11px] tracking-[0.04em] uppercase whitespace-nowrap ${active ? 'font-bold text-ink' : 'text-ink-soft'}`}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      )}

      <footer className="hidden md:block w-full max-w-[1440px] mx-auto px-4 sm:px-8 xl:px-14 pt-8 pb-8">
        <div className="tear-edge" />
        <div className="mt-4 flex items-start justify-between gap-4 flex-wrap font-mono text-[11px] tracking-[0.04em]">
          <span className="text-ink-faint">
            СТУДЕНТ−% · {new Date().getFullYear()}
            {user ? ` · ЧЕК № ${checkNumber}` : ''}
          </span>
          <div className="flex items-start gap-7 uppercase text-ink-soft flex-wrap">
            <Link to="/support" className="hover:text-ink">Поддержка</Link>
            <Link to={user?.role === 'merchant' ? '/merchant' : '/support?topic=partner'} className="hover:text-ink">Партнёрам</Link>
            <span>Правила</span>
            <Link to="/settings/privacy" className="hover:text-ink">Приватность</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
