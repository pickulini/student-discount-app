import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { RouteLoadingView } from '../design/DottedPath';
import {
  Avatar,
  Field,
  Leader,
  OutlineButton,
  PrimaryButton,
  Rule,
  Rule2,
  SectionLabel,
  Segmented,
  StatRow,
  TextButton,
  VRule,
  ddmm,
  ddmmyy,
  num,
} from './merchant/kit';
import { Crumbs } from './admin/shared';
import { ROLE } from './AdminUsers';

/** A07 · Пользователь: данные, роль, VIP, блокировка, заказы с возвратом, операции кошелька. */

const ORDER_STATUS = {
  paid: { icon: '●', label: 'Оплачен' },
  completed: { icon: '✓', label: 'Погашен' },
  redeemed: { icon: '✓', label: 'Погашен' },
  refunded: { icon: '↺', label: 'Возврат' },
  cancelled: { icon: '×', label: 'Отменён' },
  pending: { icon: '○', label: 'Ждёт оплаты' },
};

const statusKey = (o) => (o.status === 'paid' && o.redeemed ? 'redeemed' : o.status);
const refundable = (o) => o.status === 'paid' || o.status === 'completed';

const opAmount = (op) => {
  const sign = op.amount > 0 ? '+' : '−';
  const v = num(Math.abs(op.amount));
  return op.unit === 'BONUS' ? `${sign}${v} Б` : `${sign}${v} ₽`;
};

const COLS = 'grid grid-cols-[70px_minmax(0,1fr)_80px_110px_90px] gap-4 items-center';

const AdminUserCard = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [unis, setUnis] = useState(null);
  const [refund, setRefund] = useState(null); // заказ для возврата
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () =>
    api
      .get(`/admin/users/${id}/card`)
      .then((r) => setData(r.data))
      .catch(() => setError('Пользователь не найден'));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return error ? <div className="font-mono text-[12px] text-accent uppercase">{error}</div> : <RouteLoadingView label="Открываем карточку..." />;

  const { card, operations = [] } = data;
  const u = card.user;

  const run = async (key, fn, done) => {
    setBusy(key);
    setMsg('');
    try {
      await fn();
      await load();
      if (done) setMsg(done);
    } catch (e) {
      setMsg(e.response?.data?.error || 'Не получилось');
    } finally {
      setBusy(null);
    }
  };

  const setRole = (role) => role !== u.role && run('role', () => api.put('/admin/users/role', { user_id: u.id, role }), 'Роль изменена');
  const setVIP = (on) => on !== u.is_vip && run('vip', () => api.put(`/admin/users/${u.id}/vip`, { on }));
  const toggleBlock = () => run('block', () => api.put(`/admin/users/${u.id}/block`, { blocked: u.is_active }), u.is_active ? 'Аккаунт заблокирован' : 'Аккаунт разблокирован');
  const resetVerif = () => run('reset', () => api.post(`/admin/users/${u.id}/reset-verification`), 'Верификация сброшена');
  const pickUni = (uid) =>
    run('uni', () => api.patch(`/admin/users/${u.id}/university`, { university_id: uid }), 'Вуз изменён').then(() => setUnis(null));
  const openUnis = () => (unis ? setUnis(null) : api.get('/admin/universities').then((r) => setUnis(r.data || [])));

  const doRefund = () => {
    if (!reason.trim()) return setMsg('Укажите причину — её увидят студент и партнёр');
    return run('refund', () => api.post(`/orders/${refund.id}/refund`, { reason: reason.trim() }), `Возвращено ${num(refund.total)} ₽`).then(() => {
      setRefund(null);
      setReason('');
    });
  };

  const student =
    u.student === 'verified'
      ? `✓ до ${ddmmyy(u.student_until)}`
      : u.student === 'pending'
      ? '◐ ожидает'
      : u.student === 'expired'
      ? '▫ истёк'
      : '○ нет';

  return (
    <div className="flex flex-col gap-7">
      <Crumbs items={[{ to: '/admin/users', label: 'Пользователи' }, `ID ${u.id}`]} />

      <div className="flex flex-col xl:flex-row gap-10 items-start">
        <div className="w-full xl:w-[320px] shrink-0 flex flex-col gap-5">
          <Avatar src={u.avatar_url} name={u.full_name} size={96} />
          <h1 className="font-display font-bold text-[26px] leading-[1.1] tracking-[-0.02em] text-ink">{u.full_name}</h1>
          <span className="font-mono text-[12px] tracking-[0.02em] text-ink-soft">
            {[u.username ? `@${u.username}` : null, `ID ${u.id}`, u.is_active ? null : 'заблокирован'].filter(Boolean).join(' · ')}
          </span>
          <div className="flex flex-col gap-[10px]">
            <Leader label="Email" value={u.email} />
            <Leader label="Вуз" value={u.university || '—'} />
            <Leader label="Студент" value={<span className="font-bold">{student}</span>} />
            <Leader label="Создан" value={ddmmyy(u.created_at)} />
            <Leader label="Реф. код" value={String(u.referral_code || '').toUpperCase()} />
            {card.companies.length > 0 && <Leader label="Компании" value={card.companies.map((c) => c.name).join(', ')} />}
          </div>
          <Rule />
          <SectionLabel>Роль</SectionLabel>
          <Segmented
            value={u.role}
            onChange={setRole}
            items={Object.entries(ROLE).map(([key, label]) => ({ key, label, disabled: busy !== null }))}
          />
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono font-bold text-[12px] tracking-[0.04em] uppercase text-ink">★ VIP</span>
            <Segmented
              dense
              value={!!u.is_vip}
              onChange={setVIP}
              items={[
                { key: true, label: 'Вкл', disabled: busy !== null },
                { key: false, label: 'Выкл', disabled: busy !== null },
              ]}
            />
          </div>
          <Rule />
          <TextButton onClick={openUnis} className="self-start">Сменить вуз</TextButton>
          {unis && (
            <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto border border-dashed border-line p-3">
              {unis.map((x) => (
                <button
                  key={x.id}
                  onClick={() => pickUni(x.id)}
                  className="text-left font-mono text-[11px] tracking-[0.03em] uppercase text-ink-soft hover:text-ink"
                >
                  {x.short_name || x.name}
                  {x.short_name ? ` · ${x.name}` : ''}
                </button>
              ))}
            </div>
          )}
          {u.student === 'verified' && (
            <TextButton onClick={resetVerif} disabled={busy !== null} className="self-start">
              Сбросить верификацию
            </TextButton>
          )}
          <OutlineButton className="w-full" onClick={toggleBlock} disabled={busy !== null}>
            {u.is_active ? 'Заблокировать' : 'Разблокировать'}
          </OutlineButton>
          {msg && <span className="font-mono text-[11px] tracking-[0.03em] uppercase text-ink">{msg}</span>}
        </div>

        <VRule className="hidden xl:block" />

        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          <StatRow
            compact
            tight
            items={[
              { label: 'Заказов', value: num(card.orders) },
              { label: 'Пополнено', value: num(card.topped_up) },
              { label: 'Потрачено', value: num(card.spent) },
              { label: 'Возвраты', value: `${num(card.refunds)} ₽` },
              { label: 'Бонусов', value: `${num(card.bonuses)} Б` },
            ]}
          />
          <Rule2 />
          <div className="flex items-center justify-between">
            <SectionLabel>Заказы</SectionLabel>
            {card.orders > card.recent_orders.length && (
              <span className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft">Последние {card.recent_orders.length} из {num(card.orders)}</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              <div className={`${COLS} py-2 border-b border-ink font-mono font-medium text-[10px] tracking-[0.06em] uppercase text-ink-soft`}>
                <span>Дата</span>
                <span>Заказ</span>
                <span className="text-right">Сумма</span>
                <span>Статус</span>
                <span />
              </div>
              {card.recent_orders.length === 0 ? (
                <div className="py-5 text-[14px] text-ink-soft border-b border-dashed border-line">Заказов нет.</div>
              ) : (
                card.recent_orders.map((o) => {
                  const s = ORDER_STATUS[statusKey(o)] || { icon: '○', label: o.status };
                  return (
                    <div key={o.id} className={`${COLS} py-3 border-b border-dashed border-line`}>
                      <span className="font-mono text-[12px] text-ink">{ddmm(o.created_at)}</span>
                      <span className="text-[15px] text-ink truncate">
                        № {String(o.id).padStart(6, '0')} · {o.company || o.title}
                      </span>
                      <span className="font-mono text-[12px] text-ink text-right whitespace-nowrap">{num(o.total)} ₽</span>
                      <span className="font-mono font-bold text-[11px] tracking-[0.03em] uppercase text-ink whitespace-nowrap">
                        {s.icon} {s.label}
                      </span>
                      <span>
                        {refundable(o) && o.total > 0 ? (
                          <button
                            onClick={() => {
                              setRefund(o);
                              setReason('');
                              setMsg('');
                            }}
                            className="font-mono font-bold text-[11px] tracking-[0.04em] uppercase text-ink hover:text-accent"
                          >
                            Вернуть
                          </button>
                        ) : (
                          <span className="font-mono text-[11px] text-ink-soft">—</span>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {refund && (
            <div className="border-l-[3px] border-ink pl-[18px] flex flex-col gap-4">
              <span className="font-mono font-bold text-[12px] tracking-[0.04em] uppercase text-ink">
                Возврат по заказу № {String(refund.id).padStart(6, '0')} · {num(refund.total)} ₽
              </span>
              <Field label="Причина (увидят студент и партнёр)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Например: услуга не оказана" />
              <div className="flex gap-5 items-center flex-wrap">
                <PrimaryButton onClick={doRefund} disabled={busy !== null}>
                  {busy === 'refund' ? 'Возвращаем…' : `Вернуть ${num(refund.total)} ₽ на кошелёк`}
                </PrimaryButton>
                <TextButton onClick={() => setRefund(null)}>Отмена</TextButton>
              </div>
            </div>
          )}

          <Rule />
          <SectionLabel>Последние операции кошелька</SectionLabel>
          <div>
            <div className="grid grid-cols-[70px_minmax(0,1fr)_110px] gap-4 py-2 border-b border-ink font-mono font-medium text-[10px] tracking-[0.06em] uppercase text-ink-soft">
              <span>Дата</span>
              <span>Операция</span>
              <span className="text-right">Сумма</span>
            </div>
            {operations.length === 0 ? (
              <div className="py-5 text-[14px] text-ink-soft border-b border-dashed border-line">Операций нет.</div>
            ) : (
              operations.map((op, i) => (
                <div key={i} className="grid grid-cols-[70px_minmax(0,1fr)_110px] gap-4 py-3 border-b border-dashed border-line items-center">
                  <span className="font-mono text-[12px] text-ink">{ddmm(op.created_at)}</span>
                  <span className="text-[15px] text-ink truncate">{op.title}</span>
                  <span className="font-mono text-[12px] text-ink text-right whitespace-nowrap">{opAmount(op)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUserCard;
