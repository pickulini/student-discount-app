import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { Photo, Segmented, SmallButton, Tabs, ddmm, discountLabel, hhmm, num } from './merchant/kit';
import { AdminHead, agoShort, no6 } from './admin/shared';

/** A02 · Модерация: очередь предложений и ивентов по статусам. */

export const MOD_STATUS = {
  pending_review: { icon: '◐', label: 'На модерации', strong: true },
  pending_partner_approval: { icon: '↺', label: 'У партнёра', strong: true },
  published: { icon: '●', label: 'Опубликовано', strong: true },
  rejected: { icon: '✕', label: 'Отклонено', strong: true },
  draft: { icon: '○', label: 'Черновик' },
  archived: { icon: '▫', label: 'Архив' },
  expired: { icon: '▫', label: 'Истёк' },
};

export const statusOf = (o) => (o.status === 'published' && (o.expired || (o.end_at && new Date(o.end_at) < new Date())) ? 'expired' : o.status);

export const ModStatus = ({ status, className = '' }) => {
  const s = MOD_STATUS[status] || { icon: '○', label: status };
  return (
    <span className={`font-mono text-[11px] tracking-[0.03em] uppercase whitespace-nowrap ${s.strong ? 'font-bold text-ink' : 'text-ink-soft'} ${className}`}>
      {s.icon} {s.label}
    </span>
  );
};

const sentLabel = (d) => {
  const ago = agoShort(d);
  return `${ddmm(d)} · ${ago || hhmm(d)}`;
};

const TABS = [
  { key: 'pending', label: 'На модерации' },
  { key: 'partner', label: 'У партнёра' },
  { key: 'published', label: 'Опубликованные' },
  { key: 'rejected', label: 'Отклонённые' },
  { key: 'draft', label: 'Черновики' },
  { key: 'expired', label: 'Истекшие' },
  { key: 'archived', label: 'Архив' },
  { key: 'all', label: 'Все' },
];

const COLS = 'grid grid-cols-[minmax(0,1fr)_150px_80px_140px_150px_110px] gap-4 items-center';

const AdminModeration = () => {
  const [params, setParams] = useSearchParams();
  const kind = params.get('kind') === 'events' ? 'events' : 'offers';
  const tab = params.get('tab') || 'pending';
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api
      .get('/admin/moderation', { params: { kind, tab } })
      .then((r) => setData(r.data))
      .catch(() => setData({ items: [], counts: {} }));
  }, [kind, tab]);

  const set = (k, v) => {
    const p = new URLSearchParams(params);
    p.set(k, v);
    if (k === 'kind') p.delete('tab');
    setParams(p, { replace: true });
  };

  const counts = data?.counts || {};
  const tabs = TABS.map((t) => ({
    ...t,
    label: t.key === 'pending' ? `${t.label} · ${counts.pending ?? 0}` : t.key === 'partner' && counts.partner ? `${t.label} · ${counts.partner}` : t.label,
  }));

  return (
    <div className="flex flex-col gap-7">
      <AdminHead
        title="Модерация"
        subtitle="Проверьте предложение и опубликуйте, отклоните или поправьте и верните партнёру."
        right={
          <Segmented
            value={kind}
            onChange={(v) => set('kind', v)}
            items={[
              { key: 'offers', label: `Предложения · ${counts.offers ?? 0}` },
              { key: 'events', label: `Ивенты · ${counts.events ?? 0}` },
            ]}
          />
        }
      />
      <Tabs items={tabs} value={tab} onChange={(v) => set('tab', v)} />

      {!data ? (
        <RouteLoadingView label="Загружаем очередь..." />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className={`${COLS} py-2 border-b border-ink font-mono font-medium text-[10px] tracking-[0.06em] uppercase text-ink-soft`}>
              <span>{kind === 'events' ? 'Ивент' : 'Предложение'}</span>
              <span>{kind === 'events' ? 'Организатор' : 'Компания'}</span>
              <span>Скидка</span>
              <span>Отправлено</span>
              <span className="text-right">Статус</span>
              <span />
            </div>
            {data.items.length === 0 ? (
              <div className="py-6 text-[15px] text-ink-soft border-b border-dashed border-line">
                {tab === 'pending' ? 'Очередь пуста — всё разобрано.' : 'Здесь пока ничего нет.'}
              </div>
            ) : (
              data.items.map((o) => {
                const st = statusOf(o);
                const price = o.base_price > 0 ? `${num(o.base_price)} ₽` : o.special_price ? `${num(o.special_price)} ₽` : 'бесплатно';
                return (
                  <div key={o.id} className={`${COLS} py-3 border-b border-dashed border-line`}>
                    <Link to={`/admin/moderation/${o.id}`} className="flex gap-3 items-center min-w-0 group">
                      <Photo src={o.image_url} className="w-10 h-10 shrink-0" />
                      <span className="flex flex-col gap-[2px] min-w-0">
                        <span className="text-[14px] font-semibold text-ink truncate group-hover:text-accent">{o.title}</span>
                        <span className="font-mono text-[11px] tracking-[0.02em] text-ink-soft uppercase truncate">
                          {no6(o.id)} · {st === 'pending_partner_approval' ? 'правки отправлены' : price}
                        </span>
                      </span>
                    </Link>
                    <span className="text-[14px] font-medium tracking-[0.02em] text-ink truncate">{o.company || '—'}</span>
                    <span className="font-mono font-bold text-[12px] text-accent">
                      {o.discount_value > 0 ? discountLabel(o) : '—'}
                    </span>
                    <span className="font-mono text-[12px] tracking-[0.02em] uppercase text-ink">{sentLabel(o.sent_at)}</span>
                    <ModStatus status={st} className="text-right" />
                    <span>
                      {st === 'pending_review' ? (
                        <SmallButton as={Link} to={`/admin/moderation/${o.id}`}>Проверить</SmallButton>
                      ) : st === 'pending_partner_approval' ? (
                        <span className="font-mono text-[11px] tracking-[0.03em] text-ink-soft">ЖДЁМ</span>
                      ) : (
                        <Link to={`/admin/moderation/${o.id}`} className="font-mono font-bold text-[11px] tracking-[0.04em] text-ink hover:text-accent">
                          ОТКРЫТЬ →
                        </Link>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="border-l border-ink pl-[14px] flex flex-col gap-[6px]">
        <span className="font-mono font-bold text-[11px] tracking-[0.04em] text-ink">ПОРЯДОК</span>
        <span className="text-[14px] leading-[21px] text-ink-soft">
          Сначала самые старые. «Править» — если мелочь, которую можно исправить за партнёра: он получит «было / стало» и согласует одной кнопкой.
        </span>
      </div>
    </div>
  );
};

export default AdminModeration;
