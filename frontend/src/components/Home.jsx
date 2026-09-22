import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import OfferCard from './OfferCard';
import EventCard from './EventCard';
import OfferDetailModal from './OfferDetailModal';
import EventDetailModal from './EventDetailModal';
import { PageTitle, Eyebrow } from '../design/UI';
import { RouteLoadingView, RouteEmptyState, DottedDivider, TrailDivider, TrailDividerV } from '../design/DottedPath';

/**
 * Главная в духе Яндекс.Афиши: лента в основном вертикальная, с крупными
 * немногочисленными карточками, и лишь один-два горизонтальных «заезда»
 * для подборок — а не сплошной горизонтальный скролл повсюду.
 */

/** Компактная горизонтальная карусель — используется точечно, один раз. */
const Carousel = ({ title, items, renderItem }) => {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <Eyebrow className="mb-3 px-1">{title}</Eyebrow>
      <div className="flex overflow-x-auto no-scrollbar gap-4 pb-1 -mx-1 px-1">
        {items.map((item, i) => (
          <React.Fragment key={item.id}>
            {i > 0 && <TrailDividerV animated />}
            <div
              className="fade-in-up flex-shrink-0 w-64 sm:w-72"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {renderItem(item)}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/** Основная вертикальная лента — крупные карточки, 1 колонка на мобильном,
    2 на широком экране. Каждая карточка отделена штриховой «тропинкой». */
const VerticalFeed = ({ title, items, renderItem }) => {
  if (!items || items.length === 0) return null;
  return (
    <div>
      {title && <Eyebrow className="mb-3 px-1">{title}</Eyebrow>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="fade-in-up pb-8"
            style={{ animationDelay: `${Math.min(i, 6) * 70}ms` }}
          >
            {renderItem(item)}
            <TrailDivider className="mt-8" />
          </div>
        ))}
      </div>
    </div>
  );
};

const Home = () => {
  const [offers, setOffers] = useState([]);
  const [events, setEvents] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    api.get('/tags/popular?limit=15').then(res => setTags(res.data || [])).catch(console.error);
    api.get('/events?limit=4').then(res => setEvents((res.data || []).slice(0, 4))).catch(() => setEvents([]));
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

  // Один горизонтальный «заезд» — топ по скидке, немного карточек.
  // Остальное — обычная вертикальная лента крупных карточек.
  const popular = useMemo(
    () => [...offers].sort((a, b) => (b.discount_value || 0) - (a.discount_value || 0)).slice(0, 4),
    [offers]
  );
  const popularIds = useMemo(() => new Set(popular.map(o => o.id)), [popular]);
  const rest = useMemo(() => offers.filter(o => !popularIds.has(o.id)), [offers, popularIds]);

  const renderOfferMd = (offer) => <OfferCard offer={offer} onClick={handleCardClick} size="md" />;
  const renderOfferLg = (offer) => <OfferCard offer={offer} onClick={handleCardClick} size="lg" />;
  const renderEventLg = (event) => <EventCard event={event} onClick={setSelectedEvent} size="lg" />;

  return (
    <div>
      <PageTitle>Актуальные предложения</PageTitle>

      {tags.length > 0 && (
        <div className="mb-8">
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
        <div className="space-y-10">
          <Carousel title="Популярное" items={popular} renderItem={renderOfferMd} />

          <VerticalFeed title="Все предложения" items={rest} renderItem={renderOfferLg} />

          <VerticalFeed title="Ивенты" items={events} renderItem={renderEventLg} />
        </div>
      )}

      {selectedOffer && (
        <OfferDetailModal offer={selectedOffer} onClose={handleCloseModal} />
      )}

      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
};

export default Home;
