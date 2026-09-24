import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { yandexSearchUrl } from '../utils/mapLinks';
import { RouteLoadingView, RouteEmptyState } from '../design/DottedPath';
import { SectionLabel, PrimaryButton, TextButton, Barcode, pad6, ddmm, hhmm, ddmmyy } from './merchant/kit';

/**
 * D03 · Чек заказа — кассовый чек на «столе»: статус, позиции, итог,
 * экономия, QR и код для кассы. Слева «Что дальше», справа «Действия».
 */

const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const money2 = (v) => Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rubInt = (v) => `${Math.round(Number(v || 0)).toLocaleString('ru-RU')} ₽`;

const Row = ({ label, value }) => (
  <div className="flex items-end gap-2">
    <span className="font-mono text-[12px] tracking-[0.03em] uppercase text-ink whitespace-nowrap truncate">{label}</span>
    <span className="flex-1 min-w-[8px] border-t border-dashed border-ink-faint h-[4px]" />
    <span className="font-mono text-[12px] tracking-[0.01em] text-ink whitespace-nowrap">{value}</span>
  </div>
);

const R2 = () => <div className="h-[5px] border-y border-dashed border-ink" />;
const R1 = () => <div className="border-t border-dashed border-line" />;

const OrderReceipt = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [offer, setOffer] = useState(null);
  const [qr, setQr] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api
      .get(`/orders/${id}`)
      .then((r) => {
        setOrder(r.data);
        api.get(`/offers/${r.data.offer_id}`).then((o) => setOffer(o.data.offer)).catch(() => {});
      })
      .catch(() => setNotFound(true));
    api.get('/orders').then((r) => setOrders(r.data || [])).catch(() => {});
    api
      .get(`/orders/${id}/qr`, { responseType: 'text' })
      .then((r) => setQr(`data:image/svg+xml;utf8,${encodeURIComponent(r.data)}`))
      .catch(() => {});
  }, [id]);

  if (notFound) return <RouteEmptyState title="Чек не найден" action={<Link to="/order" className="btn-bracket">Все мои чеки</Link>} />;
  if (!order) return <RouteLoadingView label="Печатаем чек..." />;

  const code = `${String(order.id % 10000).padStart(4, '0')} · ${order.redeem_code}`;
  const place = order.company_name || order.offer_title;
  const saved = Number(order.discount_amount || 0) + Number(order.bonus_amount || 0);
  const now = new Date();
  const monthSaved = orders
    .filter((o) => ['paid', 'completed'].includes(o.status))
    .filter((o) => {
      const d = new Date(o.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, o) => s + Number(o.discount_amount || 0) + Number(o.bonus_amount || 0), 0);
  const pct = offer && offer.discount_type === 'percentage' ? ` ${Number(offer.discount_value)}%` : '';
  const validUntil = offer ? new Date(offer.end_at) : null;
  const studentShort = (() => {
    const parts = (user?.full_name || '').trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : user?.full_name || '';
  })();

  const status = {
    paid: ['✓ Оплачено', 'text-accent'],
    completed: ['✓ Погашено', 'text-ink'],
    created: ['◐ Ждёт оплаты', 'text-ink'],
    refunded: ['↺ Возврат', 'text-ink'],
    cancelled: ['✕ Отменён', 'text-ink'],
  }[order.status] || ['·', 'text-ink'];

  const addr = order.offer_address || offer?.address;
  const routeHref =
    offer?.latitude && offer?.longitude
      ? `https://yandex.ru/maps/?rtext=~${offer.latitude},${offer.longitude}&rtt=pd`
      : yandexSearchUrl(addr || place);

  const mailBody = encodeURIComponent(
    `Чек № ${pad6(order.id)}\n${place}${addr ? `, ${addr}` : ''}\n${order.offer_title}: ${money2(order.subtotal)}\n` +
      `Скидка: −${money2(order.discount_amount)}\nБонусы: −${money2(order.bonus_amount)}\nИтого: ${rubInt(order.total_amount)}\nКод для кассы: ${code}`
  );

  const steps = [
    `Покажите QR-код или код заказа кассиру ${place}.`,
    'Кассир отметит заказ — он появится в журнале экономии.',
    validUntil
      ? `Код действует до ${ddmmyy(validUntil)}. Передумали — оформите возврат через поддержку.`
      : 'Передумали — оформите возврат через поддержку.',
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-10 lg:gap-[90px] items-start lg:pl-[54px] print:block">
      <div className="w-full lg:w-[300px] shrink-0 flex flex-col gap-6 print:hidden">
        <SectionLabel>Что дальше</SectionLabel>
        {steps.map((s, i) => (
          <div key={i} className="flex gap-[14px]">
            <span className="font-mono text-[12px] text-ink-soft pt-[2px]">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-[15px] leading-[23px] text-ink">{s}</span>
          </div>
        ))}
      </div>

      <div className="w-full max-w-[440px] mx-auto lg:mx-0 shrink-0">
        <div className="bg-white px-7 pt-7 pb-6 flex flex-col gap-[14px] text-center">
          <div className="font-display font-bold text-[18px] text-ink">СТУДЕНТ−%</div>
          <div className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">КАССОВЫЙ ЧЕК № {pad6(order.id)}</div>
          <div className="font-mono text-[11px] tracking-[0.04em] text-ink-soft">
            {ddmmyy(order.created_at)} · {hhmm(order.created_at)} · КОШЕЛЁК
          </div>
          <R2 />
          <div className={`font-mono font-bold text-[12px] tracking-[0.04em] uppercase ${status[1]}`}>
            {status[0]}
            {order.status === 'completed' && order.redeemed_at ? ` ${ddmm(order.redeemed_at)} ${hhmm(order.redeemed_at)}` : ''}
          </div>
          <div className="-mt-2 font-display font-bold text-[24px] uppercase text-ink leading-tight">{place}</div>
          {addr && <div className="-mt-2 text-[14px] text-ink-soft">{addr}</div>}
          <R1 />
          <div className="flex flex-col gap-[9px] text-left">
            <Row label={order.offer_title} value={money2(order.subtotal)} />
            {order.discount_amount > 0 && <Row label={`Скидка студента${pct}`} value={`−${money2(order.discount_amount)}`} />}
            {order.bonus_amount > 0 && <Row label="Бонусы" value={`−${money2(order.bonus_amount)}`} />}
          </div>
          <R2 />
          <div className="flex items-end gap-2 text-left">
            <span className="font-mono font-bold text-[13px] tracking-[0.03em] uppercase text-ink">Итого</span>
            <span className="flex-1 border-t border-dashed border-ink-faint h-[10px]" />
            <span className="font-display font-bold text-[30px] leading-none text-ink whitespace-nowrap">{rubInt(order.total_amount)}</span>
          </div>
          <R1 />
          {saved > 0 && (
            <>
              <div className="font-mono text-[11px] tracking-[0.06em] uppercase text-ink-soft">Вы сэкономили</div>
              <div className="-mt-1 font-display font-bold text-[42px] leading-none text-accent">{rubInt(saved)}</div>
              <div className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft">
                За {MONTHS_NOM[now.getMonth()]} всего {rubInt(monthSaved || saved)}
              </div>
              <R2 />
            </>
          )}
          {order.status === 'paid' || order.status === 'completed' ? (
            <>
              <div className="font-mono font-bold text-[11px] tracking-[0.06em] uppercase text-ink">
                {order.status === 'completed' ? 'Заказ погашен' : 'Покажите на кассе'}
              </div>
              <div className={`mx-auto w-[170px] h-[170px] ${order.status === 'completed' ? 'opacity-25' : ''}`}>
                {qr ? <img src={qr} alt={`QR ${code}`} className="w-full h-full" /> : <div className="w-full h-full bg-surface-2" />}
              </div>
              <div className="font-mono font-bold text-[15px] tracking-[0.08em] text-ink">КОД {code}</div>
            </>
          ) : (
            <div className="font-mono text-[12px] tracking-[0.04em] uppercase text-ink-soft py-4">
              {order.status === 'created' ? 'Код появится после оплаты' : 'Код больше не действует'}
            </div>
          )}
          <R1 />
          {validUntil && (
            <div className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft">Действует до {ddmmyy(validUntil)}</div>
          )}
          <div className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft">
            {user?.student_status === 'verified' ? 'Студент ✓' : 'Студент'}
            {user?.university_short ? ` ${user.university_short}` : ''} · {studentShort}
          </div>
          <div className="flex justify-center">
            <Barcode seed={order.id} className="text-ink" />
          </div>
          <div className="font-mono font-bold text-[11px] tracking-[0.06em] uppercase text-ink">Спасибо! Приходите ещё</div>
        </div>
        <div className="tear-paper" />
      </div>

      <div className="w-full lg:w-[300px] shrink-0 flex flex-col gap-6 print:hidden">
        <SectionLabel>Действия</SectionLabel>
        <PrimaryButton as="a" href={routeHref} target="_blank" rel="noopener noreferrer" className="w-full">
          Проложить маршрут
        </PrimaryButton>
        <div className="flex flex-col items-start gap-1">
          <TextButton onClick={() => window.print()}>Сохранить как PDF</TextButton>
          <TextButton as="a" href={`mailto:${user?.email || ''}?subject=${encodeURIComponent(`Чек № ${pad6(order.id)}`)}&body=${mailBody}`}>
            Отправить на почту
          </TextButton>
          <TextButton as={Link} to="/order">Все мои чеки</TextButton>
          <TextButton as={Link} to={`/support?order=${order.id}`}>Проблема с заказом</TextButton>
        </div>
      </div>
    </div>
  );
};

export default OrderReceipt;
