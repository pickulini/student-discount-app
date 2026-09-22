import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import SubscribeButton from './SubscribeButton';
import { Card } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

const Subscriptions = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSubs = () => {
    setLoading(true);
    api.get('/subscriptions/companies')
      .then(res => setCompanies(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubs();
  }, []);

  const removeFromList = (id) => {
    setCompanies(prev => prev.filter(c => c.id !== id));
  };

  if (loading) return <RouteLoadingView label="Загрузка..." />;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-ink mb-4">Мои подписки</h1>

      {companies.length === 0 ? (
        <Card className="p-6 text-center text-ink-soft">
          Вы пока ни на кого не подписаны
          <div className="mt-2">
            <Link to="/" className="text-accent hover:underline">Смотреть офферы</Link>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {companies.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3">
              {c.logo_key ? (
                <img src={c.logo_key} alt="" className="w-12 h-12 rounded-[var(--radius-sm)] object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-[var(--radius-sm)] bg-surface-2 flex items-center justify-center text-accent font-bold">
                  {c.name[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink truncate">{c.name}</div>
                {c.description && (
                  <div className="text-xs text-ink-faint truncate">{c.description}</div>
                )}
              </div>
              <SubscribeButton
                companyId={c.id}
                initialSubscribed={true}
                onChange={(subscribed) => {
                  if (!subscribed) removeFromList(c.id);
                }}
              />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default Subscriptions;
