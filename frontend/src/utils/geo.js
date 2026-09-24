/**
 * Геолокация и расстояния для витрины («350 м · 5 мин пешком»).
 * Позиция запрашивается у браузера только с разрешения пользователя
 * и кэшируется на время сессии.
 */

let cached = null;
let pending = null;

export const distanceMeters = (a, b) => {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const formatDistance = (m) => {
  if (m == null) return '';
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} м`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} км`;
};

/** Пешком ~80 м/мин. */
export const walkMinutes = (m) => (m == null ? null : Math.max(1, Math.round(m / 80)));

/** Позиция без запроса разрешения: только если оно уже выдано. */
export const getKnownPosition = async () => {
  if (cached) return cached;
  try {
    if (!navigator.permissions || !navigator.geolocation) return null;
    const st = await navigator.permissions.query({ name: 'geolocation' });
    if (st.state !== 'granted') return null;
    return await requestPosition();
  } catch {
    return null;
  }
};

/** Явный запрос (по кнопке). */
export const requestPosition = () => {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  if (!navigator.geolocation) return Promise.resolve(null);
  pending = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        cached = { lat: p.coords.latitude, lng: p.coords.longitude };
        pending = null;
        resolve(cached);
      },
      () => {
        pending = null;
        resolve(null);
      },
      { maximumAge: 5 * 60 * 1000, timeout: 10000 }
    );
  });
  return pending;
};
