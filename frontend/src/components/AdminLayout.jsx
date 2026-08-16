import React from 'react';
import { Link, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminLayout = () => {
  const { user, isAdmin } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!isAdmin()) {
    return <div className="text-center py-8 text-red-500">Доступ запрещён. Только для администраторов.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-white shadow-md p-4">
        <h2 className="text-xl font-bold text-blue-600 mb-4">Админ-панель</h2>
        <nav className="space-y-2">
          <Link to="/admin" className="block p-2 rounded hover:bg-blue-50">📊 Статистика</Link>
          <Link to="/admin/users" className="block p-2 rounded hover:bg-blue-50">👥 Пользователи</Link>
          <Link to="/admin/companies" className="block p-2 rounded hover:bg-blue-50">🏢 Компании</Link>
          <Link to="/admin/offers" className="block p-2 rounded hover:bg-blue-50">🎁 Предложения</Link>
          <Link to="/admin/verifications" className="block p-2 rounded hover:bg-blue-50">✅ Верификации</Link>
          <Link to="/admin/support" className="block p-2 rounded hover:bg-blue-50">💬 Чаты</Link>
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

export default AdminLayout;
