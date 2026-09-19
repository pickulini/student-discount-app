import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import SubscribeButton from './SubscribeButton';

const PublicProfile = () => {
  const { handle } = useParams();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState([]);
  const [subscribedIDs, setSubscribedIDs] = useState(new Set());

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

  // Загружаем компании партнёра + свои подписки
  useEffect(() => {
    if (badUrl || !username) return;
    api.get(`/users/by-username/${encodeURIComponent(username)}/companies`)
      .then(res => setCompanies(res.data || []))
      .catch(() => setCompanies([]));

    const token = localStorage.getItem('access_token');
    if (token) {
      api.get('/subscriptions/companies/ids')
        .then(res => setSubscribedIDs(new Set(res.data || [])))
        .catch(() => {});
    }
  }, [username, badUrl]);

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

      {companies.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h3 className="font-semibold mb-3">Мои компании</h3>
          <div className="space-y-2">
            {companies.map(c => (
              <div key={c.id} className="flex items-center gap-3">
                {c.logo_key ? (
                  <img src={c.logo_key} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                    {c.name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  {c.description && (
                    <div className="text-xs text-gray-500 truncate">{c.description}</div>
                  )}
                </div>
                <SubscribeButton
                  companyId={c.id}
                  initialSubscribed={subscribedIDs.has(c.id)}
                  onChange={(isSub) => {
                    setSubscribedIDs(prev => {
                      const next = new Set(prev);
                      if (isSub) next.add(c.id); else next.delete(c.id);
                      return next;
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-400 border-t pt-3">
        На платформе с {new Date(profile.created_at).toLocaleDateString('ru-RU')}
      </div>
    </div>
  );
};

export default PublicProfile;
