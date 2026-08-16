import React, { useState, useEffect } from 'react';
import api from '../api/client';

const Home = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const res = await api.get('/offers');
        setOffers(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Failed to load offers:', err);
        setOffers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOffers();
  }, []);

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Актуальные предложения</h1>
      {offers.length === 0 ? (
        <p className="text-gray-500">Нет доступных предложений</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map(offer => (
            <div key={offer.id} className="bg-white p-4 rounded shadow">
              <h3 className="font-semibold text-lg">{offer.title}</h3>
              <p className="text-gray-600">{offer.description}</p>
              <p className="text-blue-600 font-bold">
                {offer.discount_type === 'percentage' ? `${offer.discount_value}%` : `${offer.discount_value} ₽`}
              </p>
              <p className="text-sm text-gray-500">до {new Date(offer.end_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
