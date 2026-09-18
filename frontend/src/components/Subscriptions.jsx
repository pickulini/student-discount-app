import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import SubscribeButton from './SubscribeButton';

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

  if (loading) return <div className="text-center py-8">Загрузка...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Мои подписки</h1>

      {companies.length === 0 ? (
        <div className="bg-white p-6 rounded shadow text-center text-gray-500">
          Вы пока ни на кого не подписаны
          <div className="mt-2">
            <Link to="/" className="text-blue-600 hover:underline">Смотреть офферы</Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded shadow divide-y">
          {companies.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3">
              {c.logo_key ? (
                <img src={c.logo_key} alt="" className="w-12 h-12 rounded object-cover" />
              ) : (
                <div className="w-12 h-12 rounded bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  {c.name[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{c.name}</div>
                {c.description && (
                  <div className="text-xs text-gray-500 truncate">{c.description}</div>
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
        </div>
      )}
    </div>
  );
};

export default Subscriptions;
