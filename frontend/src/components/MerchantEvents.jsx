import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import api from '../api/client';
import {
  PageHead, PrimaryButton, Tabs, Table, CellMono, CellText, StatusMark, Photo, Loading, ErrorLine, ddmm, hhmm, plural,
} from './merchant/kit';

/** P06 · Ивенты */

const WEEKDAY_ACC = ['КАЖДОЕ ВОСКРЕСЕНЬЕ', 'КАЖДЫЙ ПОНЕДЕЛЬНИК', 'КАЖДЫЙ ВТОРНИК', 'КАЖДУЮ СРЕДУ', 'КАЖДЫЙ ЧЕТВЕРГ', 'КАЖДУЮ ПЯТНИЦУ', 'КАЖДУЮ СУББОТУ'];

const bucket = (e) => {
  switch (e.status) {
    case 'published':
      return 'published';
    case 'pending_review':
    case 'pending_partner_approval':
      return 'pending';
    case 'draft':
      return 'draft';
    case 'rejected':
      return 'rejected';
    default:
      return 'archive';
  }
};

const STATUS = {
  published: ['ok', 'Опубликовано'],
  pending: ['progress', 'На модерации'],
  draft: ['draft', 'Черновик'],
  rejected: ['reject', 'Отклонён'],
  archive: ['archive', 'Завершён'],
};

const subline = (e) => {
  const b = bucket(e);
  if (b === 'pending') return `Отправлено ${ddmm(e.updated_at)}`;
  if (b === 'draft' && !e.address) return 'Не заполнено место';
  if (b === 'rejected') return e.rejection_reason || 'Отклонён';
  const rule = e.recurrence_rule || '';
  if (rule.includes('WEEKLY')) return WEEKDAY_ACC[new Date(e.start_at).getDay()];
  if (rule.includes('DAILY')) return 'Каждый день';
  if (rule.includes('MONTHLY')) return 'Каждый месяц';
  const price = e.special_price ?? e.discount_value ?? 0;
  if (!price) return 'Бесплатно';
  return 'Одноразовый';
};

const whoSees = (e, unis) => {
  switch (e.event_privacy) {
    case 'subscribers':
      return 'Подписчики';
    case 'friends':
      return 'Друзья';
    case 'university': {
      const u = unis.find((x) => x.id === e.event_university_id);
      return `Студенты ${u?.short_name || u?.name || 'вуза'}`;
    }
    case 'invite_only':
      return 'По приглашению';
    default:
      return 'Все';
  }
};

const dayLabel = (d) => {
  const x = new Date(d);
  return `${x.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '').toUpperCase()} ${ddmm(x)} ${hhmm(x)}`;
};

const MerchantEvents = () => {
  const { scope, companies } = useOutletContext();
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);
  const [goingMonth, setGoingMonth] = useState(0);
  const [unis, setUnis] = useState([]);
  const [tab, setTab] = useState('all');
  const [past, setPast] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/merchant/events')
      .then((r) => setEvents(r.data || []))
      .catch((e) => setError(e.response?.data?.error || 'Не удалось загрузить ивенты'));
    api.get('/universities').then((r) => setUnis(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get('/merchant/cabinet/stats', { params: { ...scope, period: 30 } })
      .then((r) => setGoingMonth(r.data.events?.going || 0))
      .catch(() => {});
  }, [scope.company_id]);

  const scoped = useMemo(
    () => (events || []).filter((e) => !scope.company_id || String(e.company_id) === String(scope.company_id)),
    [events, scope.company_id]
  );
  const visible = useMemo(
    () => scoped.filter((e) => past || !e.end_at || new Date(e.end_at) >= new Date() || e.recurrence_rule),
    [scoped, past]
  );
  const counts = useMemo(() => {
    const c = { all: visible.length, published: 0, pending: 0, draft: 0, rejected: 0, archive: 0 };
    visible.forEach((e) => (c[bucket(e)] += 1));
    return c;
  }, [visible]);
  const rows = visible.filter((e) => tab === 'all' || bucket(e) === tab).sort((a, b) => new Date(a.start_at) - new Date(b.start_at));

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!events) return <Loading />;

  const companyName = (id) => companies.find((c) => c.id === id)?.name || '—';

  return (
    <div className="flex flex-col gap-7">
      <PageHead
        title="Ивенты"
        subtitle={`${scoped.length} ${plural(scoped.length, 'ивент', 'ивента', 'ивентов')} · ${goingMonth} ${plural(goingMonth, 'студент отметил', 'студента отметили', 'студентов отметили')} «Пойду» за месяц`}
        right={<PrimaryButton onClick={() => navigate('/merchant/events/new')}>+ Создать ивент</PrimaryButton>}
      />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'all', label: `Все · ${counts.all}` },
            { key: 'published', label: `Опубликованные · ${counts.published}` },
            { key: 'pending', label: `На модерации · ${counts.pending}` },
            { key: 'draft', label: `Черновики · ${counts.draft}` },
            { key: 'rejected', label: counts.rejected ? `Отклонённые · ${counts.rejected}` : 'Отклонённые' },
          ]}
        />
        <button onClick={() => setPast((v) => !v)} className="font-mono font-medium text-[11px] tracking-[0.04em] uppercase text-ink">
          Прошедшие {past ? '↑' : '↓'}
        </button>
      </div>

      <Table
        columns={[
          {
            key: 'e',
            label: 'Ивент',
            render: (e) => (
              <div className="flex items-center gap-3 min-w-0">
                <Photo src={e.image_url} className="w-10 h-10 shrink-0" />
                <div className="min-w-0">
                  <CellText>{e.title}</CellText>
                  <div className="font-mono text-[11px] tracking-[0.02em] uppercase text-ink-soft truncate mt-[2px]">{subline(e)}</div>
                </div>
              </div>
            ),
          },
          { key: 'd', label: 'Дата', width: 130, render: (e) => <CellText className="font-mono text-[13px] font-normal">{bucket(e) === 'draft' && !e.address ? '—' : dayLabel(e.start_at)}</CellText> },
          { key: 'c', label: 'Компания', width: 120, render: (e) => <CellText className="font-normal">{e.company_id ? companyName(e.company_id) : 'Лично'}</CellText> },
          { key: 'w', label: 'Кто видит', width: 130, render: (e) => <CellText className="font-normal">{whoSees(e, unis)}</CellText> },
          {
            key: 'g',
            label: 'Идут / ?',
            width: 110,
            render: (e) => <CellMono>{bucket(e) === 'published' ? `${e.attendees_count} / ${e.interested_count}` : '—'}</CellMono>,
          },
          {
            key: 's',
            label: 'Статус',
            width: 150,
            render: (e) => {
              const [k, l] = STATUS[bucket(e)];
              return <StatusMark kind={k}>{l}</StatusMark>;
            },
          },
        ]}
        rows={rows}
        empty={scoped.length === 0 ? 'Ивентов пока нет — создайте первый.' : 'В этом разделе пусто.'}
      />
    </div>
  );
};

export default MerchantEvents;
