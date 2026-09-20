/**
 * Ссылка на Яндекс.Карты для координат
 */
export const yandexMapUrl = (lat, lng, zoom = 17) => {
  if (!lat || !lng) return null;
  return `https://yandex.ru/maps/?pt=${lng},${lat}&z=${zoom}&l=map`;
};

/**
 * Ссылка на OpenStreetMap для координат
 */
export const osmMapUrl = (lat, lng, zoom = 17) => {
  if (!lat || !lng) return null;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
};

/**
 * Ссылка на Яндекс.Карты для текстового адреса
 */
export const yandexSearchUrl = (text) => {
  if (!text) return null;
  return `https://yandex.ru/maps/?text=${encodeURIComponent(text)}`;
};

/**
 * Форматирует address из Nominatim в короткий вид: "Город, Улица, дом".
 * Приоритет полей: city → town → village → municipality → state.
 * Улица: road → pedestrian → footway.
 */
export const formatNominatimAddress = (address) => {
  if (!address) return '';

  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    address.state ||
    '';

  const street = address.road || address.pedestrian || address.footway || '';
  const house = address.house_number || '';

  const parts = [];
  if (city) parts.push(city);
  if (street) parts.push(street);
  if (house) parts.push(house);

  return parts.join(', ');
};
