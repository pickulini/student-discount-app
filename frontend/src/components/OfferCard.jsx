import React from 'react';

const OfferCard = ({ offer, onClick }) => {
  const discountText = offer.discount_type === 'percentage'
    ? `${offer.discount_value}%`
    : `${offer.discount_value} ₽`;

  const imageSrc = offer.image_url
    ? (offer.image_url.startsWith('http') ? offer.image_url : offer.image_url)
    : null;

  return (
    <div
      onClick={() => onClick(offer)}
      className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer overflow-hidden border border-gray-100 hover:border-blue-300 flex flex-col h-full"
    >
      {imageSrc ? (
        <div
          className="w-full h-40 bg-cover bg-center bg-gray-100"
          style={{ backgroundImage: `url('${imageSrc}')` }}
        />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-gray-500 text-sm font-medium">
          {offer.title}
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold text-gray-800 line-clamp-1">{offer.title}</h3>
          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
            {discountText}
          </span>
        </div>
        <p className="text-gray-600 text-sm mt-1 line-clamp-2 flex-1">{offer.description}</p>

        {offer.tags && offer.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {offer.tags.slice(0, 4).map(tag => (
              <span key={tag.id} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                #{tag.name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
          <span>До {new Date(offer.end_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
          <span className="flex items-center gap-1 text-blue-600">
            Подробнее
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
};

export default OfferCard;
