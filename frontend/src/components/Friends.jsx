import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { Tabs, Rule, Rule2, VRule, SectionLabel, SmallButton, TextButton, Avatar, plural } from './merchant/kit';

/** D52 · Друзья: список с активностью, поиск, заявки и «возможно, знакомы». */

const mutualLabel = (n) => (n > 0 ? `${n} ${plural(n, 'общий', 'общих', 'общих')}` : '');

const PersonLine = ({ p, extra }) => (
  <span className="font-mono text-[11px] tracking-[0.02em] text-ink-soft truncate">
    {[p.username ? `@${p.username}` : null, p.university || null, extra || null].filter(Boolean).join(' · ')}
  </span>
);

const FriendCell = ({ p }) => (
  <Link to={p.username ? `/@${p.username}` : '#'} className="flex-1 min-w-0 flex gap-[14px] items-center group">
    <Avatar src={p.avatar_url} name={p.full_name} size={48} />
    <span className="flex-1 min-w-0 flex flex-col gap-[2px]">
      <span className="text-[16px] font-semibold text-ink truncate group-hover:text-accent transition">{p.full_name}</span>
      <PersonLine p={p} />
      {p.activity && <span className="text-[13px] text-ink-soft truncate">{p.activity}</span>}
    </span>
    <span className="font-mono text-[13px] text-ink">→</span>
  </Link>
);

const SORTS = [
  { key: 'active', label: 'Активные' },
  { key: 'name', label: 'Имя' },
  { key: 'uni', label: 'Вуз' },
];

const Friends = () => {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('friends');
  const [sort, setSort] = useState('active');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(null);
  const [sent, setSent] = useState(new Set());
  const [error, setError] = useState('');

  const load = () =>
    api
      .get('/friends/overview')
      .then((r) => setData(r.data))
      .catch(() => setData({ friends: [], incoming: [], outgoing: [], suggestions: [] }));

  useEffect(() => {
    load();
  }, []);

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Не получилось');
    } finally {
      setBusy(null);
    }
  };

  const addFriend = (id) =>
    run(`add-${id}`, async () => {
      await api.post('/friends/requests', { user_id: id });
      setSent((s) => new Set(s).add(id));
    });
  const accept = (p) => run(`acc-${p.request_id}`, () => api.post(`/friends/requests/${p.request_id}/accept`));
  const reject = (p) => run(`rej-${p.request_id}`, () => api.post(`/friends/requests/${p.request_id}/reject`));
  const cancel = (p) => run(`can-${p.request_id}`, () => api.post(`/friends/requests/${p.request_id}/cancel`));

  const search = async (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return setResults(null);
    try {
      const r = await api.get('/friends/search', { params: { q: q.replace(/^@/, '') } });
      setResults(r.data || []);
    } catch {
      setResults([]);
    }
  };

  const friends = useMemo(() => {
    const list = [...(data?.friends || [])];
    if (sort === 'name') list.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'));
    else if (sort === 'uni') list.sort((a, b) => (a.university || 'я').localeCompare(b.university || 'я', 'ru') || a.full_name.localeCompare(b.full_name, 'ru'));
    else list.sort((a, b) => (b.activity ? 1 : 0) - (a.activity ? 1 : 0) || a.full_name.localeCompare(b.full_name, 'ru'));
    return list;
  }, [data, sort]);

  if (!data) return <RouteLoadingView label="Собираем друзей..." />;

  const friendIds = new Set(data.friends.map((f) => f.id));
  const outIds = new Set(data.outgoing.map((f) => f.id));
  const inIds = new Set(data.incoming.map((f) => f.id));

  const pairs = (list) => {
    const out = [];
    for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
    return out;
  };

  const renderGrid = (list, empty) =>
    list.length === 0 ? (
      <div className="text-[15px] text-ink-soft">{empty}</div>
    ) : (
      pairs(list).map((pair, i) => (
        <React.Fragment key={pair[0].id}>
          {i > 0 && <Rule />}
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-stretch">
            <FriendCell p={pair[0]} />
            <VRule className="hidden sm:block" />
            {pair[1] ? <FriendCell p={pair[1]} /> : <div className="hidden sm:block flex-1" />}
          </div>
        </React.Fragment>
      ))
    );

  const requestRow = (p, kind) => (
    <div className="flex gap-[14px] items-center">
      <Link to={p.username ? `/@${p.username}` : '#'} className="flex-1 min-w-0 flex gap-[14px] items-center group">
        <Avatar src={p.avatar_url} name={p.full_name} size={48} />
        <span className="flex-1 min-w-0 flex flex-col gap-[2px]">
          <span className="text-[16px] font-semibold text-ink truncate group-hover:text-accent">{p.full_name}</span>
          <PersonLine p={{ ...p, university: kind === 'incoming' ? '' : p.university }} extra={mutualLabel(p.mutual)} />
        </span>
      </Link>
      {kind === 'incoming' ? (
        <span className="flex gap-[10px] items-center shrink-0">
          <SmallButton onClick={() => accept(p)} disabled={busy !== null}>Принять</SmallButton>
          <button onClick={() => reject(p)} disabled={busy !== null} className="font-mono font-bold text-[13px] text-ink-soft hover:text-accent" aria-label="Отклонить">
            ✕
          </button>
        </span>
      ) : kind === 'outgoing' ? (
        <TextButton onClick={() => cancel(p)} disabled={busy !== null}>Отменить</TextButton>
      ) : sent.has(p.id) || outIds.has(p.id) ? (
        <span className="font-mono text-[11px] tracking-[0.04em] text-ink-soft whitespace-nowrap">ЗАЯВКА ОТПРАВЛЕНА</span>
      ) : (
        <button onClick={() => addFriend(p.id)} disabled={busy !== null} className="font-mono font-bold text-[11px] tracking-[0.04em] text-ink hover:text-accent whitespace-nowrap">
          + ДОБАВИТЬ
        </button>
      )}
    </div>
  );

  const stack = (list, kind, empty) =>
    list.length === 0 ? (
      <div className="text-[14px] text-ink-soft">{empty}</div>
    ) : (
      <div className="flex flex-col gap-4">
        {list.map((p, i) => (
          <React.Fragment key={`${kind}-${p.id}`}>
            {i > 0 && <Rule />}
            {requestRow(p, kind)}
          </React.Fragment>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
      <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
        <h1 className="font-display font-bold text-[36px] leading-none tracking-[-0.02em] text-ink">ДРУЗЬЯ</h1>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs
            value={tab}
            onChange={(k) => {
              setTab(k);
              setResults(null);
            }}
            items={[
              { key: 'friends', label: `Друзья · ${data.friends.length}` },
              { key: 'incoming', label: `Заявки · ${data.incoming.length}` },
              { key: 'outgoing', label: `Исходящие · ${data.outgoing.length}` },
            ]}
          />
          {tab === 'friends' && !results && (
            <div className="flex items-center gap-3 font-mono text-[11px] tracking-[0.04em] text-ink-soft uppercase whitespace-nowrap">
              <span>Сорт:</span>
              {SORTS.map((s) =>
                s.key === sort ? (
                  <span key={s.key} className="text-ink font-bold">[ {s.label} ]</span>
                ) : (
                  <button key={s.key} onClick={() => setSort(s.key)} className="uppercase hover:text-ink">
                    {s.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
        <form onSubmit={search} className="flex gap-[10px] items-center border-b border-ink pb-[10px]">
          <span className="font-mono font-bold text-[12px] tracking-[0.04em] text-ink">ПОИСК:</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) setResults(null);
            }}
            placeholder="@username или имя"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-faint"
          />
          <button type="submit" className="font-mono font-bold text-[11px] tracking-[0.04em] text-ink hover:text-accent">НАЙТИ</button>
        </form>
        {error && <div className="font-mono text-[12px] text-accent uppercase">{error}</div>}

        {results ? (
          <>
            <div className="flex items-center justify-between">
              <SectionLabel>Найдено · {results.length}</SectionLabel>
              <TextButton
                onClick={() => {
                  setResults(null);
                  setQuery('');
                }}
              >
                Сбросить
              </TextButton>
            </div>
            {results.length === 0 ? (
              <div className="text-[15px] text-ink-soft">Никого не нашли. Проверьте @username.</div>
            ) : (
              <div className="flex flex-col gap-4">
                {results.map((p, i) => (
                  <React.Fragment key={p.id}>
                    {i > 0 && <Rule />}
                    {friendIds.has(p.id) ? (
                      <div className="flex gap-3 items-center">
                        <FriendCell p={p} />
                      </div>
                    ) : inIds.has(p.id) ? (
                      requestRow(data.incoming.find((x) => x.id === p.id), 'incoming')
                    ) : (
                      requestRow(p, 'suggest')
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </>
        ) : tab === 'friends' ? (
          renderGrid(friends, 'Пока нет друзей. Найдите знакомых по @username или примите заявки.')
        ) : tab === 'incoming' ? (
          stack(data.incoming, 'incoming', 'Новых заявок нет.')
        ) : (
          stack(data.outgoing, 'outgoing', 'Вы никому не отправляли заявок.')
        )}
      </div>

      <VRule className="hidden lg:block" />

      <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-6">
        <SectionLabel>Заявки · {data.incoming.length}</SectionLabel>
        {stack(data.incoming.slice(0, 5), 'incoming', 'Новых заявок нет.')}
        <Rule2 />
        <SectionLabel>Возможно, знакомы</SectionLabel>
        {stack(data.suggestions, 'suggest', 'Подсказок пока нет — добавьте пару друзей, и мы найдём общих знакомых.')}
      </div>
    </div>
  );
};

export default Friends;
