import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { PageTitle } from '../design/UI';
import { RouteLoadingView, RouteEmptyState, TrailDivider } from '../design/DottedPath';

const MerchantCompanies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/merchant/companies')
      .then(res => setCompanies(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <RouteLoadingView label="Загрузка..." />;

  return (
    <div>
      <PageTitle>Мои компании</PageTitle>
      {companies.length === 0 ? (
        <RouteEmptyState title="Вы не привязаны ни к одной компании" />
      ) : (
        <div>
          {companies.map((c, i) => (
            <div key={c.id}>
              {i > 0 && <TrailDivider className="my-3" />}
              <div className="py-2 text-ink">{c.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MerchantCompanies;
