import api from '../api/client';

/** Экономия по заказу: цена до скидки минус оплачено (скидка + бонусы). */
export const savedOf = (o) => Math.max(0, Number(o.subtotal || 0) - Number(o.total_amount || 0));

/** Заказ «состоялся» — оплачен или уже погашен. */
export const isSpent = (o) => o.status === 'paid' || o.status === 'completed';

export const orderCode = (o) => `${String(o.id % 10000).padStart(4, '0')} · ${o.redeem_code || '····'}`;

export const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export const monthKey = (d) => {
  const x = new Date(d);
  return x.getFullYear() * 12 + x.getMonth();
};

/**
 * Заказы пользователя + справочник предложений (теги, срок, цена),
 * чтобы показать категорию и срок действия кода.
 */
export async function loadOrdersWithOffers() {
  const [ordersRes, offersRes] = await Promise.all([
    api.get('/orders'),
    api.get('/offers', { params: { limit: 500 } }).catch(() => ({ data: [] })),
  ]);
  const orders = (ordersRes.data || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const list = Array.isArray(offersRes.data) ? offersRes.data : offersRes.data?.offers || [];
  const offers = new Map(list.map((o) => [o.id, o]));
  return { orders, offers };
}

export function downloadCSV(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
