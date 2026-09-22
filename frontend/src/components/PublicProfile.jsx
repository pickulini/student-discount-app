import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import SubscribeButton from './SubscribeButton';
import { Card, Eyebrow } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

const PublicProfile = () => {
  const { handle } = useParams();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState([]);
  const [subscribedIDs, setSubscribedIDs] = useState(new Set());
  const [attendingEvents, setAttendingEvents] = useState([]);
  const [userSubscriptions, setUserSubscriptions] = useState([]);

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

    api.get(`/users/by-username/${encodeURIComponent(username)}/attending`)
      .then(res => setAttendingEvents(res.data || []))
      .catch(() => setAttendingEvents([]));

    api.get(`/users/by-username/${encodeURIComponent(username)}/subscriptions`)
      .then(res => setUserSubscriptions(res.data || []))
      .catch(() => setUserSubscriptions([]));
  }, [username, badUrl]);

  if (loading) return <RouteLoadingView label="Загрузка..." />;
  if (error) {
    return (
      <div className="max-w-lg mx-auto py-8 text-center">
        <p className="text-danger text-lg mb-4">{error}</p>
        <Link to="/" className="text-accent hover:underline">← На главную</Link>
      </div>
    );
  }
  if (!profile) return null;

  const displayName = profile.nickname || profile.full_name;
  const avatarSrc = profile.avatar_url;
  const isMe = me && me.id === profile.id;

  return (
    <Card className="max-w-lg mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        {profile.avatar_visible === false ? (
          <div className="w-20 h-20 rounded-full bg-surface-2 border border-line flex items-center justify-center text-ink-faint text-eyebrow">
            Скрыто
          </div>
        ) : avatarSrc ? (
          <img
            src={avatarSrc}
            alt="Аватар"
            className="w-20 h-20 rounded-full object-cover border border-line"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-surface-2 border border-line flex items-center justify-center text-accent text-2xl font-bold">
            {displayName?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-editorial text-2xl text-ink uppercase truncate">{displayName}</h1>
          <p className="text-accent text-sm">@{profile.username}</p>
          {profile.university && profile.university_visible !== false && (
            <p className="text-ink-faint text-sm truncate">{profile.university}</p>
          )}
        </div>
        {isMe && (
          <Link to="/profile" className="text-sm text-accent hover:underline self-start">
            Редактировать
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-surface-2 border border-line p-3 rounded-[var(--radius-sm)] text-center">
          {profile.friends_list_visible === false ? (
            <>
              <p className="text-editorial text-2xl text-ink-faint">—</p>
              <p className="text-eyebrow text-ink-soft mt-1">Скрыто</p>
            </>
          ) : (
            <>
              <p className="text-editorial text-2xl text-accent">{profile.friends_count}</p>
              <p className="text-eyebrow text-ink-soft mt-1">Друзей</p>
            </>
          )}
        </div>
        <div className="bg-surface-2 border border-line p-3 rounded-[var(--radius-sm)] text-center">
          <p className="text-editorial text-sm text-ink capitalize">{profile.student_status}</p>
          <p className="text-eyebrow text-ink-soft mt-1">Статус студента</p>
        </div>
      </div>

      {profile.subscriptions_visible === false && (
        <div className="mt-4 pt-4 border-t border-line">
          <Eyebrow className="mb-2">Подписки</Eyebrow>
          <div className="text-sm text-ink-faint">Скрыто настройками приватности</div>
        </div>
      )}

      {profile.role && profile.role !== 'student' && (
        <div className="mb-4 text-sm text-ink-soft">
          Роль: <span className="font-semibold text-ink">{profile.role}</span>
        </div>
      )}

      {attendingEvents.length > 0 && profile.attending_events_visible !== false && (
        <div className="mt-4 pt-4 border-t border-line">
          <Eyebrow className="mb-3">Планирует посетить</Eyebrow>
          <div className="space-y-2">
            {attendingEvents.map(e => {
              const d = new Date(e.start_at);
              return (
              <div key={e.id} className="flex items-center gap-3 bg-surface-2 rounded-[var(--radius-sm)] p-2">
                <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-surface flex flex-col items-center justify-center leading-none">
                  <span className="text-editorial text-sm text-ink">{d.toLocaleDateString('ru-RU', { day: 'numeric' })}</span>
                  <span className="text-eyebrow text-ink-faint text-[9px]">{d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink truncate">{e.title}</div>
                  <div className="text-caption text-xs text-ink-faint">
                    {d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {userSubscriptions.length > 0 && profile.subscriptions_visible !== false && (
        <div className="mt-4 pt-4 border-t border-line">
          <Eyebrow className="mb-3">Подписки</Eyebrow>
          <div className="space-y-2">
            {userSubscriptions.map(c => (
              <div key={c.id} className="flex items-center gap-3">
                {c.logo_key ? (
                  <img src={c.logo_key} alt="" className="w-10 h-10 rounded-[var(--radius-sm)] object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-surface-2 flex items-center justify-center text-accent font-bold">
                    {c.name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink truncate">{c.name}</div>
                  {c.description && (
                    <div className="text-xs text-ink-faint truncate">{c.description}</div>
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

      {companies.length > 0 && profile.offers_visible !== false && (
        <div className="mt-4 pt-4 border-t border-line">
          <Eyebrow className="mb-3">Мои компании</Eyebrow>
          <div className="space-y-2">
            {companies.map(c => (
              <div key={c.id} className="flex items-center gap-3">
                {c.logo_key ? (
                  <img src={c.logo_key} alt="" className="w-10 h-10 rounded-[var(--radius-sm)] object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-surface-2 flex items-center justify-center text-accent font-bold">
                    {c.name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink truncate">{c.name}</div>
                  {c.description && (
                    <div className="text-xs text-ink-faint truncate">{c.description}</div>
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

      <div className="text-caption text-xs text-ink-faint border-t border-line pt-3 mt-4">
        На платформе с {new Date(profile.created_at).toLocaleDateString('ru-RU')}
      </div>
    </Card>
  );
};

export default PublicProfile;
