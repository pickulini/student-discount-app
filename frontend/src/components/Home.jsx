import React, { useState, useEffect } from 'react';
import api from '../api/client';
import OfferCard from './OfferCard';
import OfferDetailModal from './OfferDetailModal';
import { PageTitle, Eyebrow } from '../design/UI';
import { RouteLoadingView, RouteEmptyState, DottedDivider } from '../design/DottedPath';

const Home = () => {
  const [offers, setOffers] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [subscribedCompanyIDs, setSubscribedCompanyIDs] = useState(new Set());

  useEffect(() => {
    api.get('/tags/popular?limit=15').then(res => setTags(res.data || [])).catch(console.error);

    const token = localStorage.getItem('access_token');
    if (token) {
      api.get('/subscriptions/companies/ids')
        .then(res => setSubscribedCompanyIDs(new Set(res.data || [])))
        .catch((err) => console.error('Failed to load subscriptions:', err));
    }
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

  const handleSubscriptionChange = (companyID, isSubscribed) => {
    setSubscribedCompanyIDs(prev => {
      const next = new Set(prev);
      if (isSubscribed) next.add(companyID); else next.delete(companyID);
      return next;
    });
  };

  return (
    <div>
      <PageTitle>Актуальные предложения</PageTitle>

      {tags.length > 0 && (
        <div className="mb-6">
          <Eyebrow className="mb-2">Фильтр</Eyebrow>
          <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
            {tags.map(tag => {
              const active = selectedTags.includes(tag.slug);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.slug)}
                  className={`text-sm pb-0.5 border-b transition ${
                    active
                      ? 'text-accent border-accent font-medium'
                      : 'text-ink-soft border-transparent hover:text-ink'
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
            {selectedTags.length > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-ink-faint hover:text-danger transition"
              >
                Сбросить
              </button>
            )}
          </div>
          <DottedDivider className="mt-4" />
        </div>
      )}

      {loading ? (
        <RouteLoadingView label="Загрузка предложений..." />
      ) : offers.length === 0 ? (
        <RouteEmptyState
          title={selectedTags.length > 0 ? 'По выбранным тегам ничего не найдено' : 'Нет доступных предложений'}
          action={selectedTags.length > 0 && (
            <button onClick={clearFilters} className="text-accent hover:underline text-sm">
              Сбросить фильтры
            </button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map(offer => (
            <OfferCard
              key={offer.id}
              offer={offer}
              onClick={handleCardClick}
              subscribed={subscribedCompanyIDs.has(offer.company_id)}
            />
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
