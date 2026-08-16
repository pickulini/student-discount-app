import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md p-4 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold text-blue-600">Student Discount</Link>
        <div className="space-x-4">
          {user ? (
            <>
              <Link to="/" className="hover:text-blue-600">Главная</Link>
              <Link to="/profile" className="hover:text-blue-600">Профиль</Link>
              <Link to="/wallet" className="hover:text-blue-600">Кошелёк</Link>
              <Link to="/referral" className="hover:text-blue-600">Рефералы</Link>
              <Link to="/order" className="hover:text-blue-600">Заказ</Link>
              <Link to="/history" className="hover:text-blue-600">История</Link>
              {user.email === 'admin@example.com' && (
                <Link to="/admin" className="hover:text-blue-600 font-bold text-red-600">Админка</Link>
              )}
              <span className="text-gray-600">| {user.full_name || 'Пользователь'}</span>
              <button onClick={handleLogout} className="text-red-500 hover:text-red-700">Выйти</button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-blue-600">Вход</Link>
              <Link to="/register" className="hover:text-blue-600">Регистрация</Link>
            </>
          )}
        </div>
      </nav>
      <div className="container mx-auto p-4">
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;
