import React, { useState, useEffect } from 'react';
import api from '../api/client';
import ImageUpload from './ImageUpload';
import { useAuth } from '../context/AuthContext';

const SettingsProfile = () => {
  const { fetchUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    nickname: '',
    username: '',
    avatar_url: '',
  });

  useEffect(() => {
    api.get('/users/me')
      .then((res) => {
        setForm({
          nickname: res.data.nickname || '',
          username: res.data.username || '',
          avatar_url: res.data.avatar_url || '',
        });
      })
      .catch(() => setError('Не удалось загрузить'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.patch('/users/me', {
        nickname: form.nickname || null,
        username: form.username || null,
        avatar_url: form.avatar_url || null,
      });
      setSuccess('Профиль обновлён');
      if (fetchUser) fetchUser();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-xl font-bold mb-4">Профиль</h2>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-3 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-3 rounded mb-3 text-sm">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <ImageUpload
          value={form.avatar_url}
          onChange={(url) => setForm({ ...form, avatar_url: url })}
          uploadEndpoint="/users/upload-avatar"
        />

        <div>
          <label className="block text-sm mb-1">Никнейм</label>
          <input
            type="text"
            value={form.nickname}
            onChange={(e) => setForm({ ...form, nickname: e.target.value })}
            className="w-full border p-2 rounded"
            placeholder="Артём"
            maxLength={50}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Username (@тег)</label>
          <div className="flex items-center">
            <span className="text-gray-500 mr-1">@</span>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
              className="w-full border p-2 rounded"
              placeholder="artem_2005"
              pattern="[a-z0-9_]{3,30}"
              title="3-30 символов: латиница, цифры, _"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">3-30 символов: латиница, цифры, _</p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsProfile;
