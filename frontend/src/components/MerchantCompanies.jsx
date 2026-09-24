import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import api from '../api/client';
import {
  PageHead, TextButton, Rule, Rule2, VRule, Leader, Photo, StatusMark, Loading, ErrorLine, rub, num, plural,
} from './merchant/kit';

/** P09 · Мои компании */
const MerchantCompanies = () => {
  const { setCompanyId, user } = useOutletContext();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/merchant/cabinet/companies')
      .then((r) => setList(r.data || []))
      .catch((e) => setError(e.response?.data?.error || 'Не удалось загрузить компании'));
  }, []);

  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!list) return <Loading />;

  const pairs = [];
  for (let i = 0; i < list.length; i += 2) pairs.push(list.slice(i, i + 2));

  return (
    <div className="flex flex-col gap-7">
      <PageHead
        title="Мои компании"
        subtitle="Новую компанию добавляет администратор — напишите в поддержку."
        right={<TextButton as={Link} to="/support">Запросить новую компанию</TextButton>}
      />
      <Rule2 />
      {list.length === 0 && <div className="text-[15px] text-ink-soft">К вашему аккаунту пока не привязана ни одна компания.</div>}
      {pairs.map((pair, pi) => (
        <React.Fragment key={pi}>
          {pi > 0 && <Rule />}
          <div className="flex flex-col lg:flex-row gap-10 items-stretch">
            {pair.map((c, i) => (
              <React.Fragment key={c.id}>
                {i > 0 && <VRule className="hidden lg:block" />}
                <div className="flex-1 min-w-0 flex flex-col">
                  <Photo src={c.cover_image} className="w-full h-[200px]" />
                  <div className="mt-[14px] flex items-center justify-between gap-4">
                    <div className="font-display font-bold text-[22px] tracking-[-0.01em] uppercase text-ink truncate">{c.name}</div>
                    <StatusMark kind={c.is_active ? 'ok' : 'draft'}>{c.is_active ? 'Активна' : 'Отключена'}</StatusMark>
                  </div>
                  <div className="mt-[14px] text-[15px] leading-[22px] text-ink-soft">
                    {[
                      c.category_label ? c.category_label[0].toUpperCase() + c.category_label.slice(1) : c.description,
                      c.locations.length > 0
                        ? `${c.locations.length} ${plural(c.locations.length, 'точка', 'точки', 'точек')}: ${c.locations.map((l) => l.address).join(' · ')}`
                        : 'Точки не добавлены',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <Rule className="mt-[14px]" />
                  <div className="mt-[14px] flex flex-col gap-[9px]">
                    <Leader label="Баланс" value={rub(c.balance)} />
                    <Leader
                      label="Предложений"
                      value={`${c.offers_total} · ${c.offers_active} ${plural(c.offers_active, 'активное', 'активных', 'активных')}`}
                    />
                    <Leader label="Ивентов" value={num(c.events_total)} />
                    <Leader label="Подписчиков" value={num(c.subscribers)} />
                    <Leader label="Погашено за 30 дней" value={num(c.redeemed_30d)} />
                  </div>
                  <div className="mt-[14px] flex items-center gap-5 flex-wrap">
                    {user.username && (
                      <TextButton as={Link} to={`/@${user.username}`}>Профиль компании</TextButton>
                    )}
                    <TextButton
                      onClick={() => {
                        setCompanyId(c.id);
                        navigate('/merchant/offers');
                      }}
                    >
                      Предложения →
                    </TextButton>
                  </div>
                </div>
              </React.Fragment>
            ))}
            {pair.length === 1 && list.length > 1 && <div className="flex-1 hidden lg:block" />}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

export default MerchantCompanies;
