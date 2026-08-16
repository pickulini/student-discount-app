import React, { useState, useEffect } from 'react';
import api from '../api/client';
import OfferCard from './OfferCard';
import OfferDetailModal from './OfferDetailModal';

const Home = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState(null);

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

  const handleCardClick = (offer) => {
    setSelectedOffer(offer);
  };

  const handleCloseModal = () => {
    setSelectedOffer(null);
  };

  if (loading) {
    return <div className="text-center py-12">Загрузка предложений...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Актуальные предложения</h1>
      {offers.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Нет доступных предложений</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map(offer => (
            <OfferCard key={offer.id} offer={offer} onClick={handleCardClick} />
          ))}
        </div>
      )}
      {selectedOffer && (
        <OfferDetailModal offer={selectedOffer} onClose={handleCloseModal} />
      )}
    </div>
  );
};

export default Home;
