import React from 'react';
import { Link, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MerchantLayout = () => {
  const { user, isAdmin } = useAuth();

  // Доступ только для партнёров (role == merchant)
  if (!user || user.role !== 'merchant') {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-white shadow-md p-4">
        <h2 className="text-xl font-bold text-blue-600 mb-4">Партнёрский кабинет</h2>
        <nav className="space-y-2">
          <Link to="/merchant" className="block p-2 rounded hover:bg-blue-50">📊 Дашборд</Link>
          <Link to="/merchant/offers" className="block p-2 rounded hover:bg-blue-50">🎁 Мои предложения</Link>
          <Link to="/events/new" className="block p-2 rounded hover:bg-blue-50">📅 Создать ивент</Link>
          <Link to="/events" className="block p-2 rounded hover:bg-blue-50">🎟 Мои ивенты</Link>
          <Link to="/merchant/companies" className="block p-2 rounded hover:bg-blue-50">🏢 Мои компании</Link>
          <Link to="/merchant/statistics" className="block p-2 rounded hover:bg-blue-50">📈 Статистика</Link>
          <Link to="/" className="block p-2 rounded hover:bg-blue-50 text-blue-600">← На сайт</Link>
        </nav>
      </aside>
      <div className="flex-1 p-6">
        <div className="bg-white p-6 rounded shadow">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default MerchantLayout;
