import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const Avatar = ({ user }) => {
  const letter = (user.nickname || user.full_name || '?')[0].toUpperCase();
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />;
  }
  return (
    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
      {letter}
    </div>
  );
};

const Card = ({ user, actionLabel, onAction, actionClass = 'bg-blue-600 hover:bg-blue-700' }) => (
  <div className="flex items-center gap-3 border-b py-2">
    <Avatar user={user} />
    <div className="flex-1 min-w-0">
      <div className="font-semibold truncate">{user.nickname || user.full_name}</div>
      {user.username && <div className="text-xs text-gray-500 truncate">@{user.username}</div>}
      {user.university && <div className="text-xs text-gray-400 truncate">{user.university}</div>}
    </div>
    {actionLabel && (
      <button
        onClick={() => onAction(user)}
        className={`px-3 py-1 rounded text-white text-sm ${actionClass}`}
      >
        {actionLabel}
      </button>
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
      <h1 className="text-2xl font-bold mb-4">Друзья</h1>

      <div className="flex gap-2 mb-4 border-b overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm whitespace-nowrap ${
              tab === t.id ? 'border-b-2 border-blue-600 text-blue-600 font-semibold' : 'text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="text-red-600 mb-3">{error}</div>}

      {tab === 'search' && (
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="@username или никнейм"
            className="flex-1 border rounded px-3 py-2"
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Найти
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-gray-500">Загрузка…</div>
      ) : (
        <>
          {tab === 'friends' &&
            (friends.length === 0 ? (
              <div className="text-gray-500">Пока нет друзей</div>
            ) : (
              friends.map((u) => (
                <Card
                  key={u.id}
                  user={u}
                  actionLabel="Удалить"
                  actionClass="bg-gray-500 hover:bg-gray-600"
                  onAction={() => removeFriend(u.id)}
                />
              ))
            ))}

          {tab === 'incoming' &&
            (incoming.length === 0 ? (
              <div className="text-gray-500">Входящих заявок нет</div>
            ) : (
              incoming.map((u) => (
                <div key={u.friendship_id || u.id} className="flex items-center gap-3 border-b py-2">
                  <Avatar user={u} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{u.nickname || u.full_name}</div>
                    {u.username && <div className="text-xs text-gray-500">@{u.username}</div>}
                  </div>
                  <button
                    onClick={() => acceptRequest(u.friendship_id)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                  >
                    Принять
                  </button>
                  <button
                    onClick={() => rejectRequest(u.friendship_id)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                  >
                    Отклонить
                  </button>
                </div>
              ))
            ))}

          {tab === 'outgoing' &&
            (outgoing.length === 0 ? (
              <div className="text-gray-500">Исходящих заявок нет</div>
            ) : (
              outgoing.map((u) => (
                <div key={u.friendship_id || u.id} className="flex items-center gap-3 border-b py-2">
                  <Avatar user={u} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{u.nickname || u.full_name}</div>
                    {u.username && <div className="text-xs text-gray-500">@{u.username}</div>}
                  </div>
                  <button
                    onClick={() => cancelRequest(u.friendship_id)}
                    className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
                  >
                    Отменить
                  </button>
                </div>
              ))
            ))}

          {tab === 'search' &&
            (searchResults.length === 0 ? (
              <div className="text-gray-500">Ничего не найдено</div>
            ) : (
              searchResults.map((u) => (
                <Card
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
