import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import api from '../api/client';
import {
  PageHead, PrimaryButton, SmallButton, Tabs, Table, CellMono, CellText, StatusMark, Photo, Loading, ErrorLine,
  rub, num, pad6, ddmm, ddmmyy, plural, discountLabel,
} from './merchant/kit';

/** P03 · Предложения */

const isExpired = (o) => o.status === 'expired' || o.status === 'archived' || (o.status === 'published' && new Date(o.end_at) < new Date());

export const offerBucket = (o) => {
  if (isExpired(o)) return 'archive';
  switch (o.status) {
    case 'published':
      return 'published';
    case 'pending_review':
      return 'pending';
    case 'pending_partner_approval':
      return 'waiting';
    case 'draft':
      return 'draft';
    case 'rejected':
      return 'rejected';
    default:
      return 'archive';
  }
};

const STATUS = {
  published: { kind: 'ok', label: 'Опубликовано' },
  pending: { kind: 'progress', label: 'На модерации' },
  waiting: { kind: 'back', label: 'Ждёт вас' },
  rejected: { kind: 'reject', label: 'Отклонён' },
  draft: { kind: 'draft', label: 'Черновик' },
  archive: { kind: 'archive', label: 'Истёк' },
};

const subline = (o) => {
  const b = offerBucket(o);
  const no = `№ ${pad6(o.id)}`;
  if (b === 'published' || b === 'archive') return `${no} · до ${ddmmyy(o.end_at)}`;
  if (b === 'waiting') return `${no} · правки админа`;
  if (b === 'pending') return `${no} · отправлено ${ddmm(o.updated_at)}`;
  if (b === 'rejected') return `${no} · ${o.rejection_reason || 'отклонено'}`;
  return no;
};

const ActionCell = ({ o }) => {
  const b = offerBucket(o);
  const cls = 'font-mono font-bold text-[11px] tracking-[0.04em] uppercase';
  if (b === 'waiting') return <SmallButton as={Link} to={`/merchant/offers/${o.id}/edits`}>Согласовать</SmallButton>;
  if (b === 'pending') return <Link to={`/merchant/offers/${o.id}/edit`} className={`${cls} font-medium text-ink-faint hover:text-ink`}>Смотреть</Link>;
  if (b === 'archive') return <Link to={`/merchant/offers/new?copy=${o.id}`} className={`${cls} font-medium text-ink-faint hover:text-ink`}>Повторить</Link>;
  const label = b === 'rejected' ? 'Исправить' : b === 'draft' ? 'Продолжить' : 'Изменить';
  return <Link to={`/merchant/offers/${o.id}/edit`} className={`${cls} text-ink hover:opacity-70`}>{label}</Link>;
};

const MerchantOffers = () => {
  const { scope, companies, selected } = useOutletContext();
  const navigate = useNavigate();
  const [offers, setOffers] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setOffers(null);
    api
      .get('/merchant/cabinet/offers', { params: scope })
      .then((r) => setOffers((r.data || []).sort((a, b) => b.id - a.id)))
      .catch((e) => setError(e.response?.data?.error || 'Не удалось загрузить предложения'));
  }, [scope.company_id]);

  const counts = useMemo(() => {
    const c = { all: 0, published: 0, pending: 0, waiting: 0, draft: 0, rejected: 0, archive: 0 };
    (offers || []).forEach((o) => {
      c.all += 1;
      c[offerBucket(o)] += 1;
    });
    return c;
  }, [offers]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (offers || []).filter(
      (o) => (tab === 'all' || offerBucket(o) === tab) && (!q || o.title.toLowerCase().includes(q) || (o.company_name || '').toLowerCase().includes(q))
    );
  }, [offers, tab, query]);

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!offers) return <Loading />;

  const nCompanies = selected ? 1 : companies.length;
  const tabs = [
    { key: 'all', label: `Все · ${counts.all}` },
    { key: 'published', label: `Опубликованные · ${counts.published}` },
    { key: 'pending', label: `На модерации · ${counts.pending}` },
    { key: 'waiting', label: `Ждут вас · ${counts.waiting}` },
    { key: 'draft', label: `Черновики · ${counts.draft}` },
    { key: 'rejected', label: `Отклонённые · ${counts.rejected}` },
    { key: 'archive', label: counts.archive ? `Архив · ${counts.archive}` : 'Архив' },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHead
        title="Предложения"
        subtitle={`${counts.all} ${plural(counts.all, 'предложение', 'предложения', 'предложений')} в ${nCompanies} ${plural(nCompanies, 'компании', 'компаниях', 'компаниях')}`}
        right={<PrimaryButton onClick={() => navigate('/merchant/offers/new')}>+ Новое предложение</PrimaryButton>}
      />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs items={tabs} value={tab} onChange={setTab} />
        {searchOpen ? (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => !query && setSearchOpen(false)}
            placeholder="Название или компания"
            className="w-56 border-b border-dashed border-ink bg-transparent outline-none font-mono text-[12px] tracking-[0.02em] pb-1"
          />
        ) : (
          <button onClick={() => setSearchOpen(true)} className="font-mono font-medium text-[11px] tracking-[0.04em] uppercase text-ink">
            Поиск ⌕
          </button>
        )}
      </div>

      <Table
        columns={[
          {
            key: 'offer',
            label: 'Предложение',
            render: (o) => (
              <div className="flex items-center gap-3 min-w-0">
                <Photo src={o.image_url} className="w-10 h-10 shrink-0" />
                <div className="min-w-0">
                  <CellText>{o.title}</CellText>
                  <div className="font-mono text-[11px] tracking-[0.02em] uppercase text-ink-soft truncate mt-[2px]">{subline(o)}</div>
                </div>
              </div>
            ),
          },
          { key: 'company', label: 'Компания', width: 150, render: (o) => <CellText>{o.company_name}</CellText> },
          { key: 'disc', label: 'Скидка', width: 90, render: (o) => <span className="text-ink-red text-[12px]">{discountLabel(o)}</span> },
          { key: 'price', label: 'Цена', width: 100, render: (o) => <CellMono>{o.base_price > 0 ? rub(o.base_price) : '—'}</CellMono> },
          { key: 'uses', label: 'Использ.', width: 110, render: (o) => <CellMono>{o.current_uses > 0 ? num(o.current_uses) : '—'}</CellMono> },
          {
            key: 'status',
            label: 'Статус',
            width: 150,
            align: 'right',
            render: (o) => {
              const s = STATUS[offerBucket(o)];
              return <StatusMark kind={s.kind}>{s.label}</StatusMark>;
            },
          },
          { key: 'act', label: '', width: 110, render: (o) => <ActionCell o={o} /> },
        ]}
        rows={rows}
        empty={counts.all === 0 ? 'Предложений пока нет — создайте первое.' : 'В этом разделе пусто.'}
      />

      <div className="flex items-center gap-7 flex-wrap font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft">
        <span>Обозначения:</span>
        <span>● Опубликовано</span>
        <span>◐ На модерации</span>
        <span>↺ Ждёт вашего решения</span>
        <span>✕ Отклонено</span>
        <span>○ Черновик</span>
        <span>▫ Истёк / архив</span>
      </div>
    </div>
  );
};

export default MerchantOffers;
