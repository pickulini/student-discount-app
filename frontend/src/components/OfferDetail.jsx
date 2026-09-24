import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useMobileTop } from '../context/MobileChrome';
import { yandexMapUrl, yandexSearchUrl } from '../utils/mapLinks';
import { distanceMeters, formatDistance, getKnownPosition, requestPosition, walkMinutes } from '../utils/geo';
import { RouteLoadingView, RouteEmptyState } from '../design/DottedPath';
import {
  SectionLabel, Leader, PrimaryButton, TextButton, Rule, Rule2, VRule, Photo, plural, rub, pad6, ddmmyy, discountLabel,
} from './merchant/kit';

/**
 * D02 · Предложение — отдельная страница (Figma «Концепция «Чек»»):
 * слева фото, галерея, описание, информация и мини-карта;
 * справа «Расчёт», карточка места и другие предложения этого места.
 */

const MiniMap = ({ offer, me, h = 'h-[200px]' }) => {
  const target = offer.latitude && offer.longitude ? { lat: offer.latitude, lng: offer.longitude } : null;
  const dist = me && target ? distanceMeters(me, target) : null;
  const href = target
    ? me
      ? `https://yandex.ru/maps/?rtext=${me.lat},${me.lng}~${target.lat},${target.lng}&rtt=pd`
      : yandexMapUrl(target.lat, target.lng)
    : yandexSearchUrl(offer.address);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`relative block w-full ${h} bg-desk overflow-hidden group`}>
      <svg viewBox="0 0 395 200" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <path
          d="M30 170 C 90 165, 140 120, 175 105 S 230 85, 260 92 S 330 60, 397 40"
          fill="none"
          stroke="#121212"
          strokeWidth="1.2"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="absolute left-[26px] bottom-[26px] w-2 h-2 rounded-full bg-ink" />
      <span className="absolute right-[-5px] top-[20%] w-[14px] h-[14px] rounded-full bg-accent" />
      <span className="absolute left-[40px] bottom-[12px] font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft group-hover:text-ink transition">
        {dist != null
          ? `Вы · ${formatDistance(dist)} · ${walkMinutes(dist)} мин пешком`
          : offer.address
            ? `${offer.address} · открыть карту`
            : 'Открыть карту'}
      </span>
    </a>
  );
};

const OfferDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [others, setOthers] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [photo, setPhoto] = useState(0);
  const [me, setMe] = useState(null);
  const [shared, setShared] = useState(false);
  const toggleRef = React.useRef(null);

  useEffect(() => {
    setData(null);
    setNotFound(false);
    setPhoto(0);
    api
      .get(`/offers/${id}`)
      .then((r) => {
        setData(r.data);
        const cid = r.data.offer.company_id;
        if (cid) {
          api
            .get('/offers')
            .then((l) => setOthers((l.data || []).filter((o) => o.company_id === cid && String(o.id) !== String(id)).slice(0, 4)))
            .catch(() => {});
          if (user) {
            api.get('/subscriptions/companies/ids').then((s) => setSubscribed((s.data || []).includes(cid))).catch(() => {});
          }
        }
      })
      .catch(() => setNotFound(true));
  }, [id, user]);

  useEffect(() => {
    if (user) api.get('/wallet').then((r) => setWallet(r.data)).catch(() => {});
    getKnownPosition().then((p) => p && setMe(p));
  }, [user]);

  // Телефон: «← НАЗАД» и «[ + ПОДПИСАТЬСЯ ]» в верхней строке.
  const hasCompany = !!data?.offer?.company_id;
  useMobileTop(
    {
      back: -1,
      label: 'Назад',
      right: hasCompany ? (
        <button onClick={() => toggleRef.current?.()} disabled={subBusy} className="btn-bracket text-[11px]">
          {subscribed ? '✓ Подписаны' : '+ Подписаться'}
        </button>
      ) : null,
    },
    [hasCompany, subscribed, subBusy]
  );

  if (notFound) {
    return <RouteEmptyState title="Предложение не найдено" action={<Link to="/" className="btn-bracket">На главную</Link>} />;
  }
  if (!data) return <RouteLoadingView label="Загрузка предложения..." />;

  const { offer, company, company_stats: stats } = data;
  const name = offer.company_name || offer.title;
  const category = offer.tags?.[0]?.name || company?.category_label || 'Предложения';
  const photos = [offer.image_url, ...(offer.gallery || [])].filter(Boolean);
  const isActive = offer.status === 'published' && new Date(offer.end_at) > new Date();

  const base = offer.base_price || 0;
  const studentPrice = Math.max(0, offer.discount_type === 'percentage' ? base * (1 - offer.discount_value / 100) : base - offer.discount_value);
  const maxBonus = offer.bonus_allowed ? Math.floor((studentPrice * (offer.max_bonus_percent || 0)) / 100) : 0;
  const bonus = user && wallet ? Math.min(maxBonus, Math.floor(wallet.bonus || 0)) : maxBonus;
  const total = Math.max(0, studentPrice - bonus);
  const save = Math.round(base - total);

  const addressLink = offer.latitude && offer.longitude ? yandexMapUrl(offer.latitude, offer.longitude) : yandexSearchUrl(offer.address);
  const nLocations = company?.locations?.length || 0;
  const subscribers = stats?.subscribers_count ?? company?.subscribers;

  const toggleSubscribe = async () => {
    if (!user) return navigate('/login');
    setSubBusy(true);
    try {
      if (subscribed) await api.delete(`/companies/${offer.company_id}/subscribe`);
      else await api.post(`/companies/${offer.company_id}/subscribe`);
      setSubscribed(!subscribed);
    } catch {
      /* ignore */
    } finally {
      setSubBusy(false);
    }
  };

  toggleRef.current = toggleSubscribe;

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: name, url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      /* отмена */
    }
  };

  const goPay = (method) => {
    if (!user) return navigate('/login');
    navigate(`/offers/${offer.id}/checkout${method ? `?method=${method}` : ''}`);
  };

  const mobile = (
    <div className="md:hidden flex flex-col gap-5">
      <Photo src={photos[photo]} className="w-full h-[300px]">
        {offer.address && (
          <span className="absolute left-3 bottom-[12px] right-3 truncate font-mono text-[10px] tracking-[0.06em] uppercase text-white">
            {name} · {offer.address}
          </span>
        )}
      </Photo>
      {photos.length > 1 && (
        <div className="grid grid-cols-4 gap-2 -mt-2">
          {photos.slice(0, 4).map((p, i) => (
            <button key={p} onClick={() => setPhoto(i)} className={`h-[60px] ${i === photo ? 'outline outline-1 outline-offset-2 outline-ink' : ''}`}>
              <Photo src={p} className="w-full h-full" />
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.06em] uppercase">
        <span className="text-ink-soft">Предложение № {pad6(offer.id)}</span>
        <span className={`font-bold ${isActive ? 'text-ink' : 'text-ink-soft'}`}>{isActive ? 'Активно' : 'Завершено'}</span>
      </div>
      <div className="flex flex-col gap-3">
        <h1 className="font-display font-bold text-[30px] leading-[1.1] tracking-[-0.02em] uppercase text-ink break-words">{name}</h1>
        <p className="text-[15px] leading-[24px] text-ink-soft">
          {offer.title}
          {offer.description ? `. ${offer.description}` : ''}
        </p>
        {offer.tags?.length > 0 && (
          <div className="flex gap-4 flex-wrap font-mono text-[11px] tracking-[0.06em] uppercase text-ink-soft">
            {offer.tags.map((t) => (
              <Link key={t.id} to={`/?tag=${t.slug}`}>#{t.name}</Link>
            ))}
          </div>
        )}
      </div>
      <Rule2 />
      <div className="flex flex-col gap-[10px]">
        <Leader label="Цена" value={rub(base)} />
        <Leader label="Скидка студента" value={<span className="text-accent font-bold">{discountLabel(offer)}</span>} />
        {offer.bonus_allowed && maxBonus > 0 && <Leader label={`Бонусы (до ${offer.max_bonus_percent}%)`} value={`−${bonus} ₽`} />}
      </div>
      <Rule />
      <div className="flex flex-col gap-[10px]">
        <div className="flex items-end gap-2">
          <span className="font-mono font-bold text-[12px] tracking-[0.03em] uppercase text-ink whitespace-nowrap">Итого к оплате</span>
          <span className="flex-1 border-t border-dashed border-ink-faint h-[10px]" />
          <span className="font-display font-bold text-[30px] leading-none text-ink whitespace-nowrap">{rub(total)}</span>
        </div>
        {save > 0 && <Leader soft label="Вы экономите" value={rub(save)} />}
      </div>
      <Rule2 />
      <div className="flex flex-col gap-[10px]">
        {offer.address && (
          <Leader label="Адрес" value={<a href={addressLink} target="_blank" rel="noopener noreferrer">{offer.address} →</a>} />
        )}
        {offer.working_hours && <Leader label="Часы" value={offer.working_hours} />}
        {offer.phone && <Leader label="Телефон" value={<a href={`tel:${offer.phone.replace(/[^+\d]/g, '')}`}>{offer.phone}</a>} />}
        <Leader label="Действует до" value={ddmmyy(offer.end_at)} />
      </div>
      {(offer.address || offer.latitude) && (
        <MiniMap offer={offer} me={me} h="h-[120px]" />
      )}
      <Rule />
      <PrimaryButton className="w-full" onClick={() => goPay()} disabled={!isActive}>
        {isActive ? `Оплатить ${rub(total)} · СБП` : 'Предложение завершено'}
      </PrimaryButton>
      <div className="flex items-center justify-between">
        <TextButton onClick={() => goPay('wallet')} disabled={!isActive}>С кошелька</TextButton>
        <TextButton onClick={share}>{shared ? 'Готово' : 'Поделиться'}</TextButton>
      </div>
    </div>
  );

  return (
    <>
    {mobile}
    <div className="hidden md:flex flex-col gap-8">
      <div className="font-mono text-[11px] tracking-[0.06em] uppercase text-ink-soft">
        <Link to="/" className="hover:text-ink">Предложения</Link>
        <span className="mx-3">/</span>
        <Link to={offer.tags?.[0] ? `/?tag=${offer.tags[0].slug}` : '/'} className="hover:text-ink">{category}</Link>
        <span className="mx-3">/</span>
        <span>{name}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-12 items-start">
        {/* Колонка 1 */}
        <div className="flex-1 min-w-0 w-full flex flex-col">
          <Photo src={photos[photo]} className="w-full h-[280px] sm:h-[400px] lg:h-[460px]">
            {offer.address && (
              <span className="absolute left-[14px] bottom-[13px] font-mono text-[10px] tracking-[0.06em] uppercase text-white">
                {name} · {offer.address}
              </span>
            )}
          </Photo>
          {photos.length > 1 && (
            <div className="mt-6 grid grid-cols-4 gap-3">
              {photos.slice(0, 4).map((p, i) => (
                <button key={p} onClick={() => setPhoto(i)} className={`h-[90px] ${i === photo ? 'outline outline-1 outline-offset-2 outline-ink' : ''}`}>
                  <Photo src={p} className="w-full h-full" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between font-mono text-[11px] tracking-[0.06em] uppercase">
            <span className="text-ink-soft">Предложение № {pad6(offer.id)}</span>
            <span className={`font-bold ${isActive ? 'text-ink' : 'text-ink-soft'}`}>{isActive ? 'Активно' : 'Завершено'}</span>
          </div>

          <div className="mt-6 flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <h1 className="font-display font-bold text-[34px] sm:text-[48px] leading-[1.15] tracking-[-0.02em] uppercase text-ink break-words">{name}</h1>
              <p className="mt-3 text-[17px] leading-[26px] text-ink-soft max-w-[629px]">
                {offer.title}
                {offer.description ? `. ${offer.description}` : ''}
              </p>
              {offer.tags?.length > 0 && (
                <div className="mt-3 flex gap-4 flex-wrap font-mono text-[11px] tracking-[0.06em] uppercase text-ink-soft">
                  {offer.tags.map((t) => (
                    <Link key={t.id} to={`/?tag=${t.slug}`} className="hover:text-ink">#{t.name}</Link>
                  ))}
                </div>
              )}
            </div>
            <span className="font-display font-bold text-[40px] sm:text-[56px] leading-none text-accent whitespace-nowrap">{discountLabel(offer)}</span>
          </div>

          <Rule2 className="mt-6" />

          <div className="mt-6 flex flex-col sm:flex-row gap-10">
            <div className="flex-1 min-w-0 flex flex-col gap-[10px]">
              <SectionLabel className="mb-[2px]">Информация</SectionLabel>
              {offer.address && (
                <Leader
                  label="Адрес"
                  value={
                    <a href={addressLink} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                      {offer.address} →
                    </a>
                  }
                />
              )}
              {offer.working_hours && <Leader label="Часы" value={offer.working_hours} />}
              {offer.phone && <Leader label="Телефон" value={<a href={`tel:${offer.phone.replace(/[^+\d]/g, '')}`}>{offer.phone}</a>} />}
              {offer.website && (
                <Leader
                  label="Сайт"
                  value={
                    <a href={offer.website.startsWith('http') ? offer.website : `https://${offer.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                      {offer.website.replace(/^https?:\/\//, '')}
                    </a>
                  }
                />
              )}
              <Leader label="Действует до" value={ddmmyy(offer.end_at)} />
              {!me && (offer.latitude || offer.address) && (
                <div className="mt-2">
                  <TextButton onClick={() => requestPosition().then((p) => p && setMe(p))}>Сколько идти?</TextButton>
                </div>
              )}
            </div>
            {(offer.address || offer.latitude) && (
              <div className="flex-1 min-w-0">
                <MiniMap offer={offer} me={me} />
              </div>
            )}
          </div>
        </div>

        <VRule className="hidden lg:block" />

        {/* Колонка 2 */}
        <div className="w-full lg:w-[400px] shrink-0 flex flex-col">
          <SectionLabel>Расчёт</SectionLabel>
          <div className="mt-6 flex flex-col gap-[10px]">
            <Leader label="Цена" value={rub(base)} />
            <Leader label={`Скидка студента`} value={<span className="text-accent font-bold">{discountLabel(offer)}</span>} />
            {offer.bonus_allowed && maxBonus > 0 && (
              <Leader label={`Бонусы (до ${offer.max_bonus_percent}%)`} value={`−${bonus} ₽`} />
            )}
          </div>
          <Rule className="mt-6" />
          <div className="mt-6 flex items-end gap-2">
            <span className="font-mono font-bold text-[12px] tracking-[0.03em] uppercase text-ink whitespace-nowrap">Итого</span>
            <span className="flex-1 border-t border-dashed border-ink-faint h-[10px]" />
            <span className="font-display font-bold text-[32px] leading-none text-ink whitespace-nowrap">{rub(total)}</span>
          </div>
          {save > 0 && <Leader className="mt-6" soft label="Вы экономите" value={rub(save)} />}
          <PrimaryButton className="mt-6 w-full" onClick={() => goPay()} disabled={!isActive}>
            {isActive ? `Оплатить ${rub(total)}` : 'Предложение завершено'}
          </PrimaryButton>
          <div className="mt-6 flex items-center justify-between">
            <TextButton onClick={() => goPay('wallet')} disabled={!isActive}>С кошелька</TextButton>
            <TextButton onClick={share}>{shared ? 'Готово' : 'Поделиться'}</TextButton>
          </div>

          {offer.company_id && (
            <>
              <Rule2 className="mt-6" />
              <div className="mt-6 flex items-center gap-[14px]">
                <Photo src={offer.image_url} className="w-12 h-12 shrink-0" />
                <div className="min-w-0">
                  <div className="font-display font-bold text-[15px] uppercase text-ink truncate">{name}</div>
                  <div className="text-[13px] text-ink-soft mt-[3px] truncate">
                    {[
                      company?.category_label ? company.category_label[0].toUpperCase() + company.category_label.slice(1) : null,
                      nLocations ? `${nLocations} ${plural(nLocations, 'точка', 'точки', 'точек')}` : null,
                      subscribers != null ? `${subscribers.toLocaleString('ru-RU')} ${plural(subscribers, 'подписчик', 'подписчика', 'подписчиков')}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <TextButton onClick={toggleSubscribe} disabled={subBusy}>{subscribed ? '✓ Вы подписаны' : '+ Подписаться'}</TextButton>
              </div>
            </>
          )}

          {others.length > 0 && (
            <>
              <Rule className="mt-6" />
              <SectionLabel className="mt-6">Ещё у этого места</SectionLabel>
              <div className="mt-6 flex flex-col gap-[10px]">
                {others.map((o) => (
                  <Leader
                    key={o.id}
                    label={<Link to={`/offers/${o.id}`} className="hover:text-accent">{o.title}</Link>}
                    value={<span className="text-accent font-bold">{discountLabel(o)}</span>}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default OfferDetail;
