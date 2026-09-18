import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const PublicProfile = () => {
  const { handle } = useParams();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // /@username — параметр приходит как handle="@username"
  const username = (handle || '').startsWith('@') ? handle.slice(1) : null;
  const badUrl = !username;

  useEffect(() => {
    if (badUrl) {
      setError('Неверная ссылка. Профиль должен быть вида /@username');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    api
      .get(`/users/by-username/${encodeURIComponent(username)}`)
      .then((res) => setProfile(res.data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('Пользователь не найден');
        } else {
          setError('Ошибка загрузки профиля');
        }
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return <div className="text-center py-8">Загрузка...</div>;
  if (error) {
    return (
      <div className="max-w-lg mx-auto py-8 text-center">
        <p className="text-red-500 text-lg mb-4">{error}</p>
        <Link to="/" className="text-blue-600 hover:underline">← На главную</Link>
      </div>
    );
  }
  if (!profile) return null;

  const displayName = profile.nickname || profile.full_name;
  const avatarSrc = profile.avatar_url;
  const isMe = me && me.id === profile.id;

  return (
    <div className="max-w-lg mx-auto bg-white p-6 rounded shadow">
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
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold truncate">{displayName}</h1>
          <p className="text-blue-600 text-sm">@{profile.username}</p>
          {profile.university && (
            <p className="text-gray-500 text-sm truncate">{profile.university}</p>
          )}
        </div>
        {isMe && (
          <Link
            to="/profile"
            className="text-sm text-blue-600 hover:underline self-start"
          >
            Редактировать
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-3 rounded text-center">
          <p className="text-2xl font-bold text-blue-600">{profile.friends_count}</p>
          <p className="text-xs text-gray-600">Друзей</p>
        </div>
        <div className="bg-gray-50 p-3 rounded text-center">
          <p className="text-sm font-semibold capitalize">{profile.student_status}</p>
          <p className="text-xs text-gray-600">Статус студента</p>
        </div>
      </div>

      {profile.role && profile.role !== 'student' && (
        <div className="mb-4 text-sm text-gray-600">
          Роль: <span className="font-semibold">{profile.role}</span>
        </div>
      )}

      <div className="text-xs text-gray-400 border-t pt-3">
        На платформе с {new Date(profile.created_at).toLocaleDateString('ru-RU')}
      </div>
    </div>
  );
};

export default PublicProfile;
