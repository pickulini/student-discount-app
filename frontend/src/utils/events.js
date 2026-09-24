import api from '../api/client';

export const WEEKDAYS_SHORT = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
export const WEEKDAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const WEEKDAYS_ACC = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
const EVERY_BY_DAY = ['каждое', 'каждый', 'каждый', 'каждую', 'каждый', 'каждую', 'каждую'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};
export const hhmm = (d) => new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
export const dayTitle = (d) => {
  const x = new Date(d);
  return `${WEEKDAYS_FULL[x.getDay()]}, ${x.getDate()} ${MONTHS_GEN[x.getMonth()]}`;
};
export const ddmm = (d) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

const freq = (rule) => (rule || '').match(/FREQ=(DAILY|WEEKLY|MONTHLY)/)?.[1] || null;

const step = (d, f) => {
  const x = new Date(d);
  if (f === 'DAILY') x.setDate(x.getDate() + 1);
  else if (f === 'WEEKLY') x.setDate(x.getDate() + 7);
  else x.setMonth(x.getMonth() + 1);
  return x;
};

/** Все начала ивента в интервале [from, to), с учётом повторения. */
export function occurrences(event, from, to) {
  const start = new Date(event.start_at);
  const dur = Math.max(0, new Date(event.end_at) - start);
  const f = freq(event.recurrence_rule);
  const until = event.recurrence_until ? new Date(event.recurrence_until) : null;
  const out = [];
  if (!f) {
    const end = new Date(start.getTime() + dur);
    if (end >= from && start < to) out.push({ start, end });
    return out;
  }
  let t = start;
  for (let i = 0; i < 1000 && t < to; i++) {
    if (until && t > until) break;
    const end = new Date(t.getTime() + dur);
    if (end >= from) out.push({ start: t, end });
    t = step(t, f);
  }
  return out;
}

/** Ближайшее ещё не закончившееся начало (или последнее, если всё в прошлом). */
export function nextOccurrence(event, now = new Date()) {
  const list = occurrences(event, now, addDays(now, 400));
  if (list.length) return list[0];
  return { start: new Date(event.start_at), end: new Date(event.end_at) };
}

/** «каждую среду», «каждый день», «каждый месяц». */
export function recurrenceLabel(event) {
  const f = freq(event.recurrence_rule);
  if (!f) return '';
  if (f === 'DAILY') return 'каждый день';
  if (f === 'MONTHLY') return 'каждый месяц';
  const wd = new Date(event.start_at).getDay();
  return `${EVERY_BY_DAY[wd]} ${WEEKDAYS_ACC[wd]}`;
}

export const eventPrice = (event, meta) => Number(meta?.special_price ?? event.special_price ?? 0) || 0;

export const priceLabel = (price) => (price > 0 ? `${Math.round(price).toLocaleString('ru-RU')} ₽` : 'БЕСПЛАТНО');

export const shortName = (name = '') => {
  const p = name.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : name;
};

/** Подписи ивентов (компания, организатор, мой статус) пачкой. */
export async function loadEventMeta(ids) {
  if (!ids.length) return {};
  try {
    const r = await api.get('/events/meta', { params: { ids: ids.join(',') } });
    return r.data || {};
  } catch {
    return {};
  }
}

/**
 * «Пойду»: бесплатный ивент — запись сразу; платный — заказ и оплата с кошелька.
 * Возвращает созданный заказ.
 */
export async function goToEvent(eventId) {
  const r = await api.post(`/events/${eventId}/schedule`);
  const order = r.data;
  if (order && order.status !== 'paid' && order.status !== 'completed') {
    await api.post(`/orders/${order.id}/confirm`);
  }
  return order;
}
