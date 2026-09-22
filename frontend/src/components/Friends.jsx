import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import UserLink from './UserLink';
import { Button, Input } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

const Avatar = ({ user }) => {
  const letter = (user.nickname || user.full_name || '?')[0].toUpperCase();
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />;
  }
  return (
    <div className="w-10 h-10 rounded-full bg-surface-2 border border-line flex items-center justify-center text-accent font-bold">
      {letter}
    </div>
  );
};

const Row = ({ user, actionLabel, onAction, danger = false }) => (
  <div className="flex items-center gap-3 border-b border-line py-2">
    <Avatar user={user} />
    <div className="flex-1 min-w-0">
      <div className="font-semibold truncate">
        <UserLink
          username={user.username}
          label={user.nickname || user.full_name}
          className="text-ink hover:text-accent"
        />
      </div>
      {user.username && (
        <div className="text-xs text-ink-faint truncate">
          <UserLink username={user.username} />
        </div>
      )}
      {user.university && <div className="text-xs text-ink-faint truncate">{user.university}</div>}
    </div>
    {actionLabel && (
      <Button
        onClick={() => onAction(user)}
        variant={danger ? 'ghost' : 'primary'}
        className="px-3 py-1 text-sm"
      >
        {actionLabel}
      </Button>
    )}
  </div>
);

const Friends = () => {
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [f, inc, out] = await Promise.all([
        api.get('/friends'),
        api.get('/friends/requests/incoming'),
        api.get('/friends/requests/outgoing'),
      ]);
      setFriends(f.data || []);
      setIncoming(inc.data || []);
      setOutgoing(out.data || []);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    try {
      const res = await api.get(`/friends/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(res.data || []);
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    }
  };

  const sendRequest = async (targetUser) => {
    try {
      await api.post('/friends/requests', { user_id: targetUser.id });
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка отправки заявки');
    }
  };

  const acceptRequest = async (friendshipId) => {
    try {
      await api.post(`/friends/requests/${friendshipId}/accept`);
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const rejectRequest = async (friendshipId) => {
    try {
      await api.post(`/friends/requests/${friendshipId}/reject`);
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const cancelRequest = async (friendshipId) => {
    try {
      await api.post(`/friends/requests/${friendshipId}/cancel`);
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const removeFriend = async (friendId) => {
    if (!confirm('Удалить из друзей?')) return;
    try {
      await api.delete(`/friends/${friendId}`);
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const tabs = [
    { id: 'friends', label: `Друзья (${friends.length})` },
    { id: 'incoming', label: `Входящие (${incoming.length})` },
    { id: 'outgoing', label: `Исходящие (${outgoing.length})` },
    { id: 'search', label: 'Поиск' },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-editorial text-2xl text-ink uppercase mb-4">Друзья</h1>

      <div className="flex gap-1 mb-4 border-b border-line overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm whitespace-nowrap transition ${
              tab === t.id ? 'border-b-2 border-accent text-accent font-semibold' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="text-danger mb-3">{error}</div>}

      {tab === 'search' && (
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="@username или никнейм"
            className="flex-1 border rounded-[var(--radius-sm)] px-3 py-2"
          />
          <Button type="submit">Найти</Button>
        </form>
      )}

      {loading ? (
        <RouteLoadingView label="Загрузка…" />
      ) : (
        <>
          {tab === 'friends' &&
            (friends.length === 0 ? (
              <div className="text-ink-soft">Пока нет друзей</div>
            ) : (
              friends.map((u) => (
                <Row
                  key={u.id}
                  user={u}
                  actionLabel="Удалить"
                  danger
                  onAction={() => removeFriend(u.id)}
                />
              ))
            ))}

          {tab === 'incoming' &&
            (incoming.length === 0 ? (
              <div className="text-ink-soft">Входящих заявок нет</div>
            ) : (
              incoming.map((u) => (
                <div key={u.friendship_id || u.id} className="flex items-center gap-3 border-b border-line py-2">
                  <Avatar user={u} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink truncate">{u.nickname || u.full_name}</div>
                    {u.username && <div className="text-xs text-ink-faint">@{u.username}</div>}
                  </div>
                  <Button onClick={() => acceptRequest(u.friendship_id)} className="px-3 py-1 text-sm">
                    Принять
                  </Button>
                  <Button variant="danger" onClick={() => rejectRequest(u.friendship_id)} className="px-3 py-1 text-sm border border-danger/30">
                    Отклонить
                  </Button>
                </div>
              ))
            ))}

          {tab === 'outgoing' &&
            (outgoing.length === 0 ? (
              <div className="text-ink-soft">Исходящих заявок нет</div>
            ) : (
              outgoing.map((u) => (
                <div key={u.friendship_id || u.id} className="flex items-center gap-3 border-b border-line py-2">
                  <Avatar user={u} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink truncate">{u.nickname || u.full_name}</div>
                    {u.username && <div className="text-xs text-ink-faint">@{u.username}</div>}
                  </div>
                  <Button variant="ghost" onClick={() => cancelRequest(u.friendship_id)} className="px-3 py-1 text-sm">
                    Отменить
                  </Button>
                </div>
              ))
            ))}

          {tab === 'search' &&
            (searchResults.length === 0 ? (
              <div className="text-ink-soft">Ничего не найдено</div>
            ) : (
              searchResults.map((u) => (
                <Row
                  key={u.id}
                  user={u}
                  actionLabel="Добавить"
                  onAction={() => sendRequest(u)}
                />
              ))
            ))}
        </>
      )}
    </div>
  );
};

export default Friends;
