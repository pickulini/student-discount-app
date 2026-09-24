import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  // НЕ задаём Content-Type здесь — axios сам подставит нужный
  // (application/json для объектов, multipart/form-data для FormData)
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    // Неверный пароль на входе — это тоже 401, но его показываем в форме,
    // а не перезагружаем страницу.
    const isAuthCall = url.startsWith('/auth/');
    if (error.response && error.response.status === 401 && !isAuthCall) {
      localStorage.removeItem('access_token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
