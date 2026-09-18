import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ImageUpload from './ImageUpload';
import UserLink from './UserLink';

const Profile = () => {
  const { user, fetchUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');
  const [form, setForm] = useState({ nickname: '', username: '', avatar_url: '' });

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/me');
      setData(res.data);
      setForm({
        nickname: res.data.nickname || '',
        username: res.data.username || '',
        avatar_url: res.data.avatar_url || '',
      });
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const res = await api.patch('/users/me', {
        nickname: form.nickname || null,
        username: form.username || null,
        avatar_url: form.avatar_url || null,
      });
      setData(res.data);
      setEditMode(false);
      setSuccess('Профиль обновлён');
      if (fetchUser) fetchUser();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestVerification = async () => {
    setVerifyLoading(true);
    setVerifyMessage('');
    try {
      const res = await api.post('/students/verify');
      setVerifyMessage(res.data.message || 'Заявка отправлена');
      fetchProfile();
    } catch (err) {
      setVerifyMessage(err.response?.data?.error || 'Ошибка отправки заявки');
    } finally {
      setVerifyLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8">Загрузка...</div>;
  if (!data) return <div className="text-center py-8 text-red-500">Не удалось загрузить профиль</div>;

  const isVerified = data.student_status === 'verified';
  const avatarSrc = data.avatar_url
    ? (data.avatar_url.startsWith('http') ? data.avatar_url : data.avatar_url)
    : null;
  const displayName = data.nickname || data.full_name;

  return (
    <div className="max-w-lg mx-auto bg-white p-6 rounded shadow">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-2xl font-bold">Профиль</h2>
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Редактировать
          </button>
        )}
      </div>

      {!editMode && (
        <>
          {/* Аватар + имя + @username */}
          <div className="flex items-center gap-4 mb-6">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Аватар"
                className="w-20 h-20 rounded-full object-cover border-2 border-blue-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
                {displayName?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <p className="text-xl font-semibold">{displayName}</p>
              {data.username && (
                <p className="text-sm">
                  <UserLink username={data.username} />
                  <span className="text-gray-400 text-xs ml-2">(публичный профиль)</span>
                </p>
              )}
              <p className="text-gray-500 text-sm">{data.email}</p>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <p><strong>Статус студента:</strong>{' '}
              <span className={`ml-1 px-2 py-1 rounded text-white text-sm ${
                data.student_status === 'verified' ? 'bg-green-500' :
                data.student_status === 'pending' ? 'bg-yellow-500' :
                data.student_status === 'expired' ? 'bg-orange-500' : 'bg-red-500'
              }`}>
                {data.student_status}
              </span>
            </p>
            <p><strong>Реферальный код:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{data.referral_code}</code></p>
            <p><strong>Баланс:</strong> {data.balance} ₽</p>
            <p><strong>Бонусы:</strong> {data.bonus_balance}</p>
          </div>

          {success && <div className="mt-4 text-green-600 text-sm">{success}</div>}

          {!isVerified && (
            <div className="mt-4 border-t pt-4">
              <button
                onClick={handleRequestVerification}
                disabled={verifyLoading}
                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {verifyLoading ? 'Отправка...' : 'Запросить верификацию студента'}
              </button>
              {verifyMessage && (
                <p className={`mt-2 text-sm ${verifyMessage.includes('Ошибка') ? 'text-red-500' : 'text-green-600'}`}>
                  {verifyMessage}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {editMode && (
        <form onSubmit={handleSave} className="space-y-4">
          {error && <div className="text-red-500 text-sm">{error}</div>}

          <ImageUpload
            value={form.avatar_url}
            onChange={(url) => setForm({ ...form, avatar_url: url })}
            uploadEndpoint="/users/upload-avatar"
          />

          <div>
            <label className="block text-sm mb-1">Никнейм (как показывать имя)</label>
            <input
              type="text"
              value={form.nickname}
              onChange={e => setForm({ ...form, nickname: e.target.value })}
              className="w-full border p-2 rounded"
              placeholder="Например: Артём"
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
                onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })}
                className="w-full border p-2 rounded"
                placeholder="artem_2005"
                pattern="[a-z0-9_]{3,30}"
                title="3-30 символов: латиница, цифры, _"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Уникальный тег для друзей. 3-30 символов: латиница, цифры, _
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={() => { setEditMode(false); setError(''); }}
              className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400"
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default Profile;
