import React, { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// SVG иконки (уменьшенные)
const HomeIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" /></svg>;
const UserIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const WalletIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const ReferralIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const FriendsIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const OrderIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const HistoryIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const SupportIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829 2.829m2.829-2.829l-2.829-2.829M6.343 18.364a9 9 0 010-12.728m0 0l-2.829-2.829m2.829 2.829l-2.829 2.829M12 13a1 1 0 100-2 1 1 0 000 2z" /></svg>;
const MenuIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>;
const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>;

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMenuOpen(false);
  };

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const userLinks = [
    { to: '/', label: 'Главная', icon: HomeIcon },
    { to: '/profile', label: 'Профиль', icon: UserIcon },
    { to: '/wallet', label: 'Кошелёк', icon: WalletIcon },
    { to: '/referral', label: 'Рефералы', icon: ReferralIcon },
    { to: '/friends', label: 'Друзья', icon: FriendsIcon },
    { to: '/order', label: 'Заказ', icon: OrderIcon },
    { to: '/history', label: 'История', icon: HistoryIcon },
    { to: '/support', label: 'Поддержка', icon: SupportIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="container mx-auto px-3 py-2 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-blue-600 flex items-center gap-1">
            <span>🎓</span> Student Discount
          </Link>

          <button onClick={toggleMenu} className="lg:hidden text-gray-600 hover:text-blue-600">
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <div className="hidden lg:flex items-center gap-2 text-sm">
            {user ? (
              <>
                {userLinks.map((link) => (
                  <Link key={link.to} to={link.to} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition">
                    <link.icon />
                    <span className="hidden sm:inline">{link.label}</span>
                  </Link>
                ))}
                {user.role === 'merchant' && (
                  <Link to="/merchant" className="flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition">
                    <span>🏢</span> <span className="hidden sm:inline">Партнёр</span>
                  </Link>
                )}
                {user.role === 'admin' && (
                  <Link to="/admin" className="flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 text-red-600 font-semibold transition">
                    <span>⚙️</span> Админка
                  </Link>
                )}
                <span className="text-gray-500 text-xs px-1">| {user.full_name}</span>
                <button onClick={handleLogout} className="text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition">Выйти</button>
              </>
            ) : (
              <>
                <Link to="/login" className="px-3 py-1 rounded hover:bg-blue-50 text-gray-700 transition">Вход</Link>
                <Link to="/register" className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 transition">Регистрация</Link>
              </>
            )}
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 p-3 shadow-lg">
            <div className="flex flex-col gap-2 text-sm">
              {user ? (
                <>
                  {userLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-50 text-gray-700"
                    >
                      <link.icon />
                      {link.label}
                    </Link>
                  ))}
                  {user.role === 'merchant' && (
                    <Link to="/merchant" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-50 text-gray-700">
                      <span>🏢</span> Партнёр
                    </Link>
                  )}
                  {user.role === 'admin' && (
                    <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-red-50 text-red-600 font-semibold">
                      <span>⚙️</span> Админка
                    </Link>
                  )}
                  <div className="border-t pt-2 mt-1 flex items-center justify-between">
                    <span className="text-gray-600 text-sm">{user.full_name}</span>
                    <button onClick={handleLogout} className="text-red-500 hover:text-red-700 px-3 py-1 rounded hover:bg-red-50 transition">Выйти</button>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="px-3 py-2 rounded hover:bg-blue-50 text-gray-700">Вход</Link>
                  <Link to="/register" onClick={() => setMenuOpen(false)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition text-center">Регистрация</Link>
                </>
              )}
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
