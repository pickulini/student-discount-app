import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { Rule, Rule2, SectionLabel, Meta, StatRow, Leader, AlertBlock, Avatar, Photo, num, rub, ddmm, hhmm, plural } from './merchant/kit';

export const EVENT_STATUS = {
  draft: 'Черновик',
  pending_review: 'На модерации',
  pending_partner_approval: 'На модерации',
  rejected: 'Отклонён',
  published: 'Опубликован',
  expired: 'Прошёл',
  archived: 'В архиве',
};

/** Сводка организатора и список «моих» ивентов с цифрами (вкладка «Мои»). */
export const MyEventsPanel = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    api
      .get('/events/my/stats')
      .then((r) => setData(r.data))
      .catch(() => setData({ totals: {}, events: [] }));
  }, []);

  if (!data) return <div className="py-10 font-mono text-[12px] uppercase text-ink-soft">Считаем статистику…</div>;
  const t = data.totals || {};
  const list = data.events || [];
  if (!list.length) {
    return (
      <div className="text-[15px] text-ink-soft py-2">
        Вы ещё не предлагали ивентов. Когда предложите — здесь появятся просмотры, кто идёт и продажи билетов.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <SectionLabel>Статистика организатора</SectionLabel>
      <StatRow
        tight
        items={[
          { label: 'Просмотров', value: num(t.viewers) },
          { label: 'Идут', value: num(t.going) },
          { label: 'Думают', value: num(t.interested) },
          { label: 'Ивентов', value: num(t.events), caption: `${t.upcoming || 0} впереди` },
        ]}
      />
      <div className="flex flex-col gap-[10px]">
        {t.pending > 0 && <Leader label="На модерации" value={String(t.pending)} />}
        {t.going_7d > 0 && <Leader label="Новых «Пойду» за неделю" value={`+${t.going_7d}`} />}
        {t.tickets > 0 && (
          <>
            <Leader label="Билетов продано" value={String(t.tickets)} />
            <Leader label="Выручка" value={rub(t.revenue)} strong />
          </>
        )}
      </div>
      <Rule2 />
      <SectionLabel>Мои ивенты</SectionLabel>
      {list.map((e, i) => (
        <React.Fragment key={e.id}>
          {i > 0 && <Rule />}
          <Link to={`/events/${e.id}/stats`} className="flex gap-4 items-start group">
            <span className="flex-1 min-w-0 flex flex-col gap-[6px]">
              <span className="font-display font-bold text-[15px] sm:text-[18px] leading-[1.2] tracking-[-0.01em] uppercase text-ink group-hover:text-accent transition">
                {e.title}
              </span>
              <span className="flex gap-[10px] flex-wrap font-mono text-[11px] tracking-[0.02em] uppercase text-ink-soft">
                <span>{e.start_at ? `${ddmm(e.start_at)} ${hhmm(e.start_at)}` : '—'}</span>
                <span className={`font-bold ${e.status === 'rejected' ? 'text-accent' : ''}`}>{EVENT_STATUS[e.status] || e.status}</span>
              </span>
              <span className="flex gap-3 flex-wrap font-mono text-[11px] tracking-[0.02em] uppercase text-ink-soft">
                <span>Просм. {e.viewers}</span>
                <span className="font-bold text-ink">Идут {e.going}</span>
                <span>Думают {e.interested}</span>
                {e.tickets > 0 && <span>Билетов {e.tickets}</span>}
              </span>
            </span>
            <Photo src={e.image_url} className="w-[64px] h-[64px] sm:w-[96px] sm:h-[72px] shrink-0" />
          </Link>
        </React.Fragment>
      ))}
    </div>
  );
};

/** Столбики за 14 дней: светлые — просмотры, красные — новые «Пойду». */
const DaysChart = ({ days }) => {
  const max = Math.max(1, ...days.map((d) => Math.max(d.viewers, d.going)));
  const label = (s) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}` : '');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-1 h-[110px]">
        {days.map((d) => (
          <div key={d.day} className="flex-1 min-w-px relative h-full flex items-end" title={`${label(d.day)} · просмотров ${d.viewers} · «Пойду» ${d.going}`}>
            <div className="w-full bg-ink-faint/45" style={{ height: `${Math.max(2, (d.viewers / max) * 100)}%` }} />
            {d.going > 0 && <div className="absolute bottom-0 left-0 right-0 bg-accent" style={{ height: `${Math.max(3, (d.going / max) * 100)}%` }} />}
          </div>
        ))}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-ink-soft">
        <span>{label(days[0]?.day)}</span>
        <span>{label(days[days.length - 1]?.day)}</span>
      </div>
      <div className="flex gap-4 font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft">
        <span className="flex items-center gap-[6px]"><span className="w-[10px] h-[10px] bg-ink-faint/45" /> Просмотры</span>
        <span className="flex items-center gap-[6px]"><span className="w-[10px] h-[10px] bg-accent" /> Новые «Пойду»</span>
      </div>
    </div>
  );
};

/** Статистика одного ивента для организатора: /events/:id/stats. */
const EventStats = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/events/${id}/stats`)
      .then((r) => setD(r.data))
      .catch(() => setError('Статистику видит только организатор ивента.'));
  }, [id]);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/events?tab=mine'));

  if (error) {
    return (
      <div className="max-w-[760px] mx-auto px-5 sm:px-10 py-8 flex flex-col gap-6">
        <button onClick={back} className="self-start font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink py-2 pr-6">← Назад</button>
        <div className="text-[15px] text-ink-soft">{error}</div>
      </div>
    );
  }
  if (!d) return <RouteLoadingView label="Считаем статистику..." />;

  const conv = d.viewers > 0 ? Math.min(100, Math.round((d.going / d.viewers) * 100)) : null;
  const people = d.attendees || [];

  return (
    <div className="max-w-[760px] mx-auto px-5 sm:px-10 py-6 sm:py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        {/* На телефоне «назад» уже есть в шапке сайта. */}
        <button onClick={back} className="hidden md:block font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink py-2 pr-6 hover:text-accent">
          ← Мои ивенты
        </button>
        <span className="md:hidden" />
        <Link to={`/events/${id}`} className="font-mono font-medium text-[11px] tracking-[0.06em] uppercase text-ink hover:text-accent">
          Страница ивента →
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        <Meta>Статистика · ивент № {String(id).padStart(4, '0')}</Meta>
        <h1 className="font-display font-bold text-[26px] sm:text-[36px] leading-[1.1] tracking-[-0.02em] uppercase text-ink">{d.title}</h1>
        <div className="flex gap-3 font-mono text-[12px] tracking-[0.02em] uppercase text-ink-soft">
          <span>{d.start_at ? `${ddmm(d.start_at)} ${hhmm(d.start_at)}` : '—'}</span>
          <span className={`font-bold ${d.status === 'rejected' ? 'text-accent' : 'text-ink'}`}>{EVENT_STATUS[d.status] || d.status}</span>
        </div>
      </div>
      {d.status === 'rejected' && d.rejection_reason && <AlertBlock title="Причина отклонения">{d.rejection_reason}</AlertBlock>}
      <Rule2 />
      <StatRow
        tight
        items={[
          { label: 'Просмотров', value: num(d.viewers) },
          { label: 'Идут', value: num(d.going) },
          { label: 'Думают', value: num(d.interested) },
          { label: 'Конверсия', value: conv === null ? '—' : `${conv}%`, caption: 'в «Пойду»' },
        ]}
      />
      <div className="flex flex-col gap-[10px]">
        <Leader label="Новых «Пойду» за неделю" value={`+${d.going_7d || 0}`} />
        {(d.price > 0 || d.tickets > 0) && (
          <>
            <Leader label="Билетов продано" value={String(d.tickets || 0)} />
            <Leader label="Выручка" value={rub(d.revenue)} strong />
          </>
        )}
      </div>
      <Rule2 />
      <SectionLabel>Последние 14 дней</SectionLabel>
      <DaysChart days={d.days || []} />
      <Rule2 />
      <div className="flex items-center justify-between">
        <SectionLabel>Кто придёт</SectionLabel>
        <Meta>
          {people.length} {plural(people.length, 'человек', 'человека', 'человек')}
        </Meta>
      </div>
      {people.length === 0 && (
        <div className="text-[14px] text-ink-soft">Пока никто не отметился. Поделитесь ссылкой на ивент с друзьями.</div>
      )}
      <div className="flex flex-col gap-4">
        {people.map((a) => (
          <div key={a.id} className="flex items-center gap-4">
            <Link to={a.username ? `/@${a.username}` : '#'} className="flex items-center gap-4 flex-1 min-w-0">
              <Avatar src={a.avatar_url} name={a.full_name} size={40} />
              <span className="flex flex-col min-w-0">
                <span className="text-[15px] font-semibold text-ink truncate">{a.nickname || a.full_name}</span>
                <span className="font-mono text-[11px] tracking-[0.02em] text-ink-soft truncate">
                  {[a.username && `@${a.username}`, a.university].filter(Boolean).join(' · ')}
                </span>
              </span>
            </Link>
            <span className="flex flex-col items-end gap-[2px] font-mono text-[11px] font-bold uppercase">
              <span className={a.status === 'going' ? 'text-ink' : 'text-ink-soft'}>{a.status === 'going' ? 'Идёт' : 'Думает'}</span>
              {a.paid && <span className="text-accent text-[10px]">✓ Билет</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventStats;
