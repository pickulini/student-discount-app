import React, { useState, useEffect } from 'react';
import api from '../api/client';

const ROWS = [
  { key: 'enabled', label: 'Все уведомления', hint: 'Главный выключатель' },
  { key: 'friends', label: '👥 Друзья', hint: 'Заявки в друзья, принятие' },
  { key: 'events', label: '📅 Ивенты', hint: 'Новые ивенты подписок и друзей' },
  { key: 'offers', label: '🎁 Офферы', hint: 'Новые предложения компаний' },
];

const SettingsNotifications = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/me/notification-settings')
      .then((res) => {
        setSettings({
          enabled: res.data.enabled !== false,
          friends: res.data.friends !== false,
          events: res.data.events !== false,
          offers: res.data.offers !== false,
        });
      })
      .catch(() => setError('Не удалось загрузить'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      await api.patch('/users/me/notification-settings', settings);
      setSuccess('Настройки сохранены');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-xl font-bold mb-1">Уведомления</h2>
      <p className="text-sm text-gray-500 mb-4">Выберите, что вам присылать</p>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-3 rounded mb-3 text-sm">{success}</div>}

      <div className="space-y-1">
        {ROWS.map(({ key, label, hint }) => {
          const disabled = key !== 'enabled' && !settings.enabled;
          return (
            <label
              key={key}
              className={`flex items-center justify-between gap-3 py-3 border-b last:border-0 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
            >
              <div>
                <div className="text-sm font-medium text-gray-800">{label}</div>
                <div className="text-xs text-gray-500">{hint}</div>
              </div>
              <input
                type="checkbox"
                checked={!!settings[key]}
                disabled={disabled}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                className="w-5 h-5"
              />
            </label>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-5 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Сохранение...' : 'Сохранить'}
      </button>
    </div>
  );
};

export default SettingsNotifications;
