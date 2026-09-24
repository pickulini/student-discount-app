import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import { Avatar, SmallButton, Tabs, ddmm, ddmmyy, hhmm, num } from './merchant/kit';
import { AdminHead, durationLabel } from './admin/shared';

/** A04 · Верификации: очередь заявок студентов. */

export const VERIF_STATUS = {
  pending: { icon: '◐', label: 'Ожидает' },
  verified: { icon: '✓', label: 'Подтверждён' },
  rejected: { icon: '×', label: 'Отклонён' },
};

export const VerifStatus = ({ status, className = '' }) => {
  const s = VERIF_STATUS[status] || { icon: '○', label: status };
  return (
    <span className={`font-mono font-bold text-[11px] tracking-[0.03em] uppercase whitespace-nowrap text-ink ${className}`}>
      {s.icon} {s.label}
    </span>
  );
};

const COLS = 'grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_70px_130px_130px_110px_100px] gap-4 items-center';

const AdminVerifications = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'pending';
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api
      .get('/admin/verifications/queue', { params: { tab } })
      .then((r) => setData(r.data))
      .catch(() => setData({ items: [], meta: {} }));
  }, [tab]);

  const meta = data?.meta || {};
  const tabs = [
    { key: 'pending', label: `Ожидают · ${meta.pending ?? 0}` },
    { key: 'verified', label: 'Подтверждённые' },
    { key: 'rejected', label: 'Отклонённые' },
    { key: 'expiring', label: `Истекают в 30 дней · ${num(meta.expiring ?? 0)}` },
    { key: 'all', label: 'Все' },
  ];
  const hasManual = (data?.items || []).some((v) => !v.domain_match);

  return (
    <div className="flex flex-col gap-7">
      <AdminHead
        title="Верификации"
        subtitle="Проверьте студенческий и селфи. Срок ответа — 24 часа."
        right={
          meta.avg_seconds ? (
            <span className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft whitespace-nowrap">
              Среднее время проверки {durationLabel(meta.avg_seconds * 1000)}
            </span>
          ) : null
        }
      />
      <Tabs items={tabs} value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} />

      {!data ? (
        <RouteLoadingView label="Загружаем заявки..." />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className={`${COLS} py-2 border-b border-ink font-mono font-medium text-[10px] tracking-[0.06em] uppercase text-ink-soft`}>
              <span>Студент</span>
              <span>Email</span>
              <span>Вуз</span>
              <span>Студенческий</span>
              <span>Отправлено</span>
              <span className="text-right">Статус</span>
              <span />
            </div>
            {data.items.length === 0 ? (
              <div className="py-6 text-[15px] text-ink-soft border-b border-dashed border-line">
                {tab === 'pending' ? 'Все заявки проверены.' : 'Здесь пока ничего нет.'}
              </div>
            ) : (
              data.items.map((v) => (
                <div key={v.id} className={`${COLS} py-3 border-b border-dashed border-line`}>
                  <Link to={`/admin/verifications/${v.id}`} className="flex gap-3 items-center min-w-0 group">
                    <Avatar src={v.avatar_url} name={v.full_name} size={36} />
                    <span className="flex flex-col gap-[2px] min-w-0">
                      <span className="text-[15px] font-medium text-ink truncate group-hover:text-accent">{v.full_name}</span>
                      <span className="font-mono text-[11px] text-ink-soft truncate">{v.username ? `@${v.username}` : `ID ${v.user_id}`}</span>
                    </span>
                  </Link>
                  <span className="text-[15px] text-ink truncate">{v.email}</span>
                  <span className="font-mono text-[12px] tracking-[0.02em] uppercase text-ink">
                    {v.university || '—'}
                    {!v.domain_match && ' ?'}
                  </span>
                  <span className="font-mono text-[12px] tracking-[0.02em] text-ink truncate">{v.student_identifier || '—'}</span>
                  <span className="font-mono text-[12px] tracking-[0.02em] text-ink whitespace-nowrap">
                    {ddmm(v.created_at)} · {hhmm(v.created_at)}
                  </span>
                  <VerifStatus status={v.status} className="text-right" />
                  <span>
                    {v.status === 'pending' ? (
                      <SmallButton as={Link} to={`/admin/verifications/${v.id}`}>Проверить</SmallButton>
                    ) : v.status === 'verified' ? (
                      <span className="font-mono text-[11px] tracking-[0.03em] uppercase text-ink-soft">
                        {v.expires_at ? `до ${ddmmyy(v.expires_at)}` : ''}
                      </span>
                    ) : (
                      <Link
                        to={`/admin/verifications/${v.id}`}
                        title={v.rejection_reason}
                        className="block font-mono text-[11px] tracking-[0.03em] uppercase text-ink-soft truncate hover:text-ink"
                      >
                        {(v.rejection_reason || 'отказ').split(/[;.—]/)[0]}
                      </Link>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {hasManual && (
        <div className="border-l border-ink pl-[14px] flex flex-col gap-[6px]">
          <span className="font-mono font-bold text-[11px] tracking-[0.04em] text-ink">? ПОЧТА НЕ ВУЗОВСКАЯ</span>
          <span className="text-[14px] leading-[21px] text-ink-soft">
            Если вуз определён не по домену почты, а указан вручную — проверяйте особенно внимательно.
          </span>
        </div>
      )}
    </div>
  );
};

export default AdminVerifications;
