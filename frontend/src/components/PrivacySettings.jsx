import React, { useState, useEffect } from 'react';
import api from '../api/client';

const FIELDS = [
  { key: 'avatar_visibility', label: 'Аватар', hint: 'Фотография профиля' },
  { key: 'email_visibility', label: 'Email', hint: 'Контактный email' },
  { key: 'university_visibility', label: 'Вуз', hint: 'Название университета' },
  { key: 'friends_list_visibility', label: 'Список друзей', hint: 'Кто у вас в друзьях' },
  { key: 'subscribers_visibility', label: 'Подписчики компании', hint: 'Кто подписан на ваши компании' },
  { key: 'subscriptions_visibility', label: 'Мои подписки', hint: 'На какие компании вы подписаны' },
  { key: 'attending_events_visibility', label: 'Планирую посетить', hint: 'Ивенты, куда вы идёте' },
  { key: 'organizing_events_visibility', label: 'Мои ивенты', hint: 'Ивенты, которые вы организуете' },
  { key: 'offers_visibility', label: 'Мои офферы', hint: 'Предложения ваших компаний' },
  { key: 'statistics_visibility', label: 'Статистика', hint: 'Метрики мерчанта' },
];

const OPTIONS = [
  { value: 'public', label: '👁 Всем' },
  { value: 'friends', label: '👥 Друзьям' },
  { value: 'private', label: '🔒 Только мне' },
];

const PrivacySettings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/me')
      .then((res) => {
        const next = {};
        FIELDS.forEach(({ key }) => {
          next[key] = res.data[key] || 'public';
        });
        setSettings(next);
      })
      .catch(() => setError('Не удалось загрузить настройки'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSuccess('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.patch('/users/me/privacy', settings);
      setSuccess('Настройки сохранены');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-8">Загрузка...</div>;

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-1">Приватность</h3>
        <p className="text-sm text-gray-500">
          Управляйте, кто видит каждую часть вашего профиля.
        </p>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-3 rounded mb-3 text-sm">{success}</div>}

      <div className="space-y-2">
        {FIELDS.map(({ key, label, hint }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-3 border-b py-3 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-800">{label}</div>
              {hint && <div className="text-xs text-gray-500">{hint}</div>}
            </div>
            <select
              value={settings[key] || 'public'}
              onChange={(e) => handleChange(key, e.target.value)}
              className="border rounded px-2 py-1 text-sm bg-white"
            >
              {OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить настройки приватности'}
        </button>
      </div>
    </div>
  );
};

export default PrivacySettings;
