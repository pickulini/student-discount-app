import React, { useState, useEffect } from 'react';
import api from '../api/client';

const MerchantCompanies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/merchant/companies')
      .then(res => setCompanies(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Мои компании</h2>
      {companies.length === 0 ? (
        <p className="text-gray-500">Вы не привязаны ни к одной компании</p>
      ) : (
        <ul className="divide-y">
          {companies.map(c => (
            <li key={c.id} className="py-2">{c.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MerchantCompanies;
