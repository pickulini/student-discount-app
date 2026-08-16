import React from 'react';

const OfferDetailModal = ({ offer, onClose }) => {
  if (!offer) return null;

  const discountText = offer.discount_type === 'percentage'
    ? `${offer.discount_value}%`
    : `${offer.discount_value} ₽`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold text-gray-800">{offer.title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
              ✕
            </button>
          </div>
          <div className="mt-2">
            <span className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
              {discountText}
            </span>
            {offer.bonus_allowed && (
              <span className="ml-2 inline-block bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                Бонусы до {offer.max_bonus_percent}%
              </span>
            )}
          </div>
          <p className="mt-4 text-gray-700">{offer.description}</p>
          <div className="mt-6 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-gray-600">Организация</p>
              <p className="text-gray-800">Компания-партнёр</p>
            </div>
            <div>
              <p className="font-semibold text-gray-600">Адрес</p>
              <p className="text-gray-800">г. Москва, ул. Примерная, д. 1</p>
            </div>
            <div>
              <p className="font-semibold text-gray-600">Телефон</p>
              <p className="text-gray-800">+7 (999) 123-45-67</p>
            </div>
            <div>
              <p className="font-semibold text-gray-600">Сайт</p>
              <a href="https://example.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">example.com</a>
            </div>
            <div className="md:col-span-2">
              <p className="font-semibold text-gray-600">Часы работы</p>
              <p className="text-gray-800">Пн–Пт: 10:00–20:00, Сб–Вс: 11:00–18:00</p>
            </div>
            <div className="md:col-span-2">
              <p className="font-semibold text-gray-600">Условия</p>
              <p className="text-gray-800">Действует при предъявлении студенческого билета. Не суммируется с другими акциями.</p>
            </div>
            <div className="md:col-span-2">
              <p className="font-semibold text-gray-600">Действует до</p>
              <p className="text-gray-800">{new Date(offer.end_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">Использовать предложение</button>
            <button className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition" onClick={onClose}>Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfferDetailModal;
