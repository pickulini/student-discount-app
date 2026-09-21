import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

// === Иконки ===
const CalendarIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const OrderIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const UserIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const WalletIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const ReferralIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const StarIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>;
const GearIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const FriendsIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const HistoryIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const SupportIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829 2.829m2.829-2.829l-2.829-2.829M6.343 18.364a9 9 0 010-12.728m0 0l-2.829-2.829m2.829 2.829l-2.829 2.829M12 13a1 1 0 100-2 1 1 0 000 2z" /></svg>;
const MenuIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>;
const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>;
const LogoutIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Закрытие profile dropdown по клику вне
  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMenuOpen(false);
    setProfileOpen(false);
  };

  const closeAll = () => {
    setMenuOpen(false);
    setProfileOpen(false);
  };

  // Верхнее меню — только самое нужное
  const topLinks = [
    { to: '/events', label: 'Ивенты', icon: CalendarIcon },
    { to: '/order', label: 'Заказы', icon: OrderIcon },
  ];

  // Всё остальное — в dropdown профиля
  const dropdownLinks = [
    { to: '/friends', label: 'Друзья', icon: FriendsIcon },
    { to: '/subscriptions', label: 'Подписки', icon: StarIcon },
    { to: '/wallet', label: 'Кошелёк', icon: WalletIcon },
    { to: '/referral', label: 'Рефералы', icon: ReferralIcon },
    { to: '/history', label: 'История', icon: HistoryIcon },
    { to: '/support', label: 'Поддержка', icon: SupportIcon },
  ];

  const displayName = user?.nickname || user?.full_name || '';
  const avatarUrl = user?.avatar_url;
  const publicProfileUrl = user?.username ? `/@${user.username}` : '/profile';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="container mx-auto px-3 py-2 flex items-center justify-between gap-2">
          {/* Logo */}
          <Link to="/" className="text-xl font-bold text-blue-600 flex items-center gap-1 flex-shrink-0">
            <span>🎓</span>
            <span className="hidden sm:inline">Student Discount</span>
          </Link>

          {/* Central menu (desktop) */}
          {user && (
            <div className="hidden md:flex items-center gap-1 text-sm flex-1 ml-4">
              {topLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition"
                >
                  <link.icon />
                  <span>{link.label}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <NotificationBell />

                {/* Profile dropdown (desktop) */}
                <div className="relative hidden md:block" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 rounded-full hover:bg-gray-100 transition p-0.5 pr-2"
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                        {displayName[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <svg
                      className={`w-3 h-3 text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border z-50 overflow-hidden">
                      {/* Header */}
                      <div className="px-4 py-3 border-b bg-gray-50">
                        <div className="font-semibold text-sm truncate">{displayName}</div>
                        {user.username && (
                          <div className="text-xs text-blue-600">@{user.username}</div>
                        )}
                        <div className="text-xs text-gray-500 truncate">{user.email}</div>
                      </div>

                      {/* Мой профиль */}
                      <div className="py-1">
                        <Link
                          to={publicProfileUrl}
                          onClick={closeAll}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <UserIcon /> Мой профиль
                        </Link>
                        <Link
                          to="/settings"
                          onClick={closeAll}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <GearIcon /> Настройки
                        </Link>
                      </div>

                      {/* Основные ссылки */}
                      <div className="py-1 border-t">
                        {dropdownLinks.map((link) => (
                          <Link
                            key={link.to}
                            to={link.to}
                            onClick={closeAll}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <link.icon /> {link.label}
                          </Link>
                        ))}
                      </div>

                      {/* Роли */}
                      {(user.role === 'merchant' || user.role === 'admin') && (
                        <div className="py-1 border-t">
                          {user.role === 'merchant' && (
                            <Link
                              to="/merchant"
                              onClick={closeAll}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <span>🏢</span> Партнёрский кабинет
                            </Link>
                          )}
                          {user.role === 'admin' && (
                            <Link
                              to="/admin"
                              onClick={closeAll}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 font-semibold hover:bg-red-50"
                            >
                              <span>⚙️</span> Админка
                            </Link>
                          )}
                        </div>
                      )}

                      {/* Logout */}
                      <div className="border-t py-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                        >
                          <LogoutIcon /> Выйти
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile burger */}
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="md:hidden text-gray-600 hover:text-blue-600 p-1"
                >
                  {menuOpen ? <CloseIcon /> : <MenuIcon />}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="px-3 py-1.5 rounded-lg hover:bg-blue-50 text-gray-700 text-sm transition">
                  Вход
                </Link>
                <Link to="/register" className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 text-sm transition">
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile drawer */}
        {menuOpen && user && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-lg max-h-[80vh] overflow-y-auto">
            <div className="p-3 flex flex-col gap-1 text-sm">
              {/* Header */}
              <div className="flex items-center gap-3 px-2 py-3 border-b mb-2">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                    {displayName[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold truncate">{displayName}</div>
                  {user.username && <div className="text-xs text-blue-600">@{user.username}</div>}
                </div>
              </div>

              {/* Top */}
              {topLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={closeAll}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-700"
                >
                  <link.icon /> {link.label}
                </Link>
              ))}

              <div className="border-t my-2" />

              {/* Profile */}
              <Link to={publicProfileUrl} onClick={closeAll} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-700">
                <UserIcon /> Мой профиль
              </Link>
              <Link to="/settings" onClick={closeAll} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-700">
                <GearIcon /> Настройки
              </Link>

              <div className="border-t my-2" />

              {/* Dropdown links */}
              {dropdownLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={closeAll}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-700"
                >
                  <link.icon /> {link.label}
                </Link>
              ))}

              {(user.role === 'merchant' || user.role === 'admin') && <div className="border-t my-2" />}

              {user.role === 'merchant' && (
                <Link to="/merchant" onClick={closeAll} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-700">
                  <span>🏢</span> Партнёрский кабинет
                </Link>
              )}
              {user.role === 'admin' && (
                <Link to="/admin" onClick={closeAll} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 font-semibold">
                  <span>⚙️</span> Админка
                </Link>
              )}

              <div className="border-t my-2" />

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-red-500 w-full text-left"
              >
                <LogoutIcon /> Выйти
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="flex-1 container mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-200 py-3 text-center text-gray-500 text-xs">
        © 2026 Student Discount App
      </footer>
    </div>
  );
};

export default Layout;
