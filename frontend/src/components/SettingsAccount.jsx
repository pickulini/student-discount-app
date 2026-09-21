import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const SettingsAccount = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!confirm('Вы уверены? Это необратимо.')) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete('/users/me', { data: { password: deletePassword } });
      logout();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления');
      setDeleting(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Баланс и бонусы */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-bold mb-4">Кошелёк</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-xl">
            <div className="text-xs text-gray-600 mb-1">Баланс</div>
            <div className="text-2xl font-bold text-blue-700">{user.balance || 0} ₽</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-xl">
            <div className="text-xs text-gray-600 mb-1">Бонусы</div>
            <div className="text-2xl font-bold text-yellow-700">{user.bonus_balance || 0}</div>
          </div>
        </div>
      </div>

      {/* Реферальная программа */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-bold mb-4">Реферальная программа</h2>
        <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="min-w-0">
            <div className="text-xs text-gray-500 mb-1">Ваш код</div>
            <div className="font-mono text-lg font-semibold truncate">{user.referral_code}</div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(user.referral_code);
            }}
            className="bg-white border px-3 py-1 rounded text-sm hover:bg-gray-100"
          >
            Копировать
          </button>
        </div>
      </div>

      {/* Информация об аккаунте */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-bold mb-4">Информация</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Аккаунт создан</span>
            <span className="font-medium">{formatDate(user.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Роль</span>
            <span className="font-medium capitalize">{user.role}</span>
          </div>
          {user.is_vip && (
            <div className="flex justify-between">
              <span className="text-gray-500">VIP</span>
              <span className="font-medium text-yellow-600">
                ⭐ Активен
                {user.vip_until && ` до ${formatDate(user.vip_until)}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Опасная зона */}
      <div className="bg-white rounded-2xl shadow p-6 border-2 border-red-100">
        <h2 className="text-xl font-bold mb-1 text-red-700">Удаление аккаунта</h2>
        <p className="text-sm text-gray-500 mb-4">
          Все данные будут удалены безвозвратно: заказы, друзья, подписки, баланс.
        </p>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-3 text-sm">{error}</div>}

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Удалить аккаунт
          </button>
        ) : (
          <form onSubmit={handleDelete} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Введите пароль для подтверждения</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={deleting}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Удаление...' : 'Удалить навсегда'}
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setError(''); }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SettingsAccount;
