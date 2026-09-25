import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  // НЕ задаём Content-Type здесь — axios сам подставит нужный
  // (application/json для объектов, multipart/form-data для FormData)
});

/*
 * Токены. Access-токен живёт недолго (JWT_EXPIRY_MIN на сервере), refresh-токен —
 * пока жива сессия (30 дней, продлевается при каждом обновлении). Раньше обновления
 * не было вовсе: через полчаса любой запрос получал 401 и выкидывал на вход.
 */
const ACCESS = 'access_token';
const REFRESH = 'refresh_token';

const read = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export const setTokens = (access, refresh) => {
  try {
    if (access) localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  } catch {
    /* приватный режим — живём до перезагрузки */
  }
};

export const clearTokens = () => {
  try {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  } catch {
    /* ничего */
  }
};

/** Сколько секунд осталось жить access-токену (по полю exp). null — не разобрать. */
const secondsLeft = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp - Date.now() / 1000 : null;
  } catch {
    return null;
  }
};

// Одно обновление на всю вкладку: параллельные запросы ждут один и тот же промис.
let refreshing = null;

/** Обновить access-токен. Возвращает новый токен или null, если сессия закончилась. */
export const refreshAccessToken = () => {
  if (refreshing) return refreshing;
  const rt = read(REFRESH);
  if (!rt) return Promise.resolve(null);
  refreshing = axios
    .post('/api/v1/auth/refresh', { refresh_token: rt })
    .then((r) => {
      setTokens(r.data.access_token);
      return r.data.access_token;
    })
    .catch((e) => {
      // Другая вкладка могла уже обновить токен — берём его, если он свежий.
      const current = read(ACCESS);
      if (current && (secondsLeft(current) ?? 0) > 30) return current;
      if (e.response && e.response.status === 401) return null; // сессия отозвана или истекла
      throw e; // нет сети — не разлогиниваем
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

/** Токен, которому жить ещё хотя бы минуту: при необходимости обновляет заранее. */
export const freshAccessToken = async () => {
  const token = read(ACCESS);
  if (!token) return null;
  const left = secondsLeft(token);
  if (left !== null && left < 60 && read(REFRESH)) {
    try {
      return (await refreshAccessToken()) || token;
    } catch {
      return token;
    }
  }
  return token;
};

const goLogin = () => {
  clearTokens();
  if (window.location.pathname !== '/login') window.location.href = '/login';
};

api.interceptors.request.use(async (config) => {
  const isAuthCall = (config.url || '').startsWith('/auth/');
  const token = isAuthCall ? read(ACCESS) : await freshAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const url = config.url || '';
    // Неверный пароль на входе — это тоже 401, но его показываем в форме.
    const isAuthCall = url.startsWith('/auth/');
    if (error.response?.status !== 401 || isAuthCall) return Promise.reject(error);

    // Истёк токен — обновляем и повторяем запрос один раз.
    if (!config._retried && read(REFRESH)) {
      config._retried = true;
      let token = null;
      try {
        token = await refreshAccessToken();
      } catch {
        return Promise.reject(error); // сеть недоступна — остаёмся в аккаунте
      }
      if (token) {
        config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
        return api(config);
      }
    }
    goLogin();
    return Promise.reject(error);
  }
);

export default api;
