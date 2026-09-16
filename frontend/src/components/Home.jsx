import React, { useState, useEffect } from 'react';
import api from '../api/client';
import OfferCard from './OfferCard';
import OfferDetailModal from './OfferDetailModal';

const Home = () => {
  const [offers, setOffers] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState(null);

  useEffect(() => {
    api.get('/tags').then(res => setTags(res.data || [])).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (selectedTags.length > 0) {
      params.tags = selectedTags.join(',');
    }
    api.get('/offers', { params })
      .then(res => setOffers(Array.isArray(res.data) ? res.data : []))
      .catch(err => {
        console.error('Failed to load offers:', err);
        setOffers([]);
      })
      .finally(() => setLoading(false));
  }, [selectedTags]);

  const toggleTag = (slug) => {
    setSelectedTags(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const clearFilters = () => setSelectedTags([]);

  const handleCardClick = (offer) => setSelectedOffer(offer);
  const handleCloseModal = () => setSelectedOffer(null);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4 text-gray-800">Актуальные предложения</h1>

      {tags.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-500 mr-1">Фильтр:</span>
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.slug)}
                className={`px-3 py-1 rounded-full text-sm border transition ${
                  selectedTags.includes(tag.slug)
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                #{tag.name}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button
                onClick={clearFilters}
                className="px-3 py-1 rounded-full text-sm text-red-500 hover:text-red-700 underline"
              >
                Сбросить
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Загрузка предложений...</div>
      ) : offers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-2">
            {selectedTags.length > 0
              ? 'По выбранным тегам ничего не найдено'
              : 'Нет доступных предложений'}
          </p>
          {selectedTags.length > 0 && (
            <button onClick={clearFilters} className="text-blue-600 hover:underline">
              Сбросить фильтры
            </button>
          )}
        </div>
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
