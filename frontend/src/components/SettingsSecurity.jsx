import React, { useState, useEffect } from 'react';
import api from '../api/client';

const SettingsSecurity = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const fetchSessions = () => {
    api.get('/users/me/sessions')
      .then((res) => setSessions(res.data || []))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setChanging(true);
    try {
      await api.patch('/users/me/password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setSuccess('Пароль изменён. Все сессии отозваны, войдите заново.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка смены пароля');
    } finally {
      setChanging(false);
    }
  };

  const revokeSession = async (id) => {
    if (!confirm('Отозвать эту сессию?')) return;
    try {
      await api.delete(`/users/me/sessions/${id}`);
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const revokeAll = async () => {
    if (!confirm('Отозвать все сессии? Вам нужно будет войти заново.')) return;
    try {
      await api.delete('/users/me/sessions');
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU');
  };

  return (
    <div className="space-y-4">
      {/* Смена пароля */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-bold mb-1">Смена пароля</h2>
        <p className="text-sm text-gray-500 mb-4">
          После смены пароля все активные сессии будут отозваны
        </p>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-3 text-sm">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 p-3 rounded mb-3 text-sm">{success}</div>}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Текущий пароль</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Новый пароль</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border p-2 rounded"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Повторите новый пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <button
            type="submit"
            disabled={changing}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {changing ? 'Сохранение...' : 'Изменить пароль'}
          </button>
        </form>
      </div>

      {/* Сессии */}
      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">Активные сессии</h2>
            <p className="text-sm text-gray-500">Устройства, где вы вошли</p>
          </div>
          {sessions.length > 1 && (
            <button
              onClick={revokeAll}
              className="text-sm text-red-500 hover:underline"
            >
              Отозвать все
            </button>
          )}
        </div>

        {sessionsLoading ? (
          <div className="text-center py-4 text-gray-500">Загрузка...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">Нет активных сессий</div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl">
                  {/mobile|android|iphone/i.test(s.user_agent || '') ? '📱' : '💻'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {s.device_name || 'Неизвестное устройство'}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{s.ip || '—'}</div>
                  <div className="text-xs text-gray-400">
                    Последняя активность: {formatDate(s.last_used_at)}
                  </div>
                </div>
                <button
                  onClick={() => revokeSession(s.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Отозвать
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsSecurity;
