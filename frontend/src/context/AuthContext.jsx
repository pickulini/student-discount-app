import React, { createContext, useState, useContext, useEffect } from 'react';
import api, { setTokens, clearTokens } from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await api.get('/users/me');
      setUser(res.data);
      return res.data;
    } catch (err) {
      // Разлогиниваем только если сервер сказал «не авторизован» (это уже сделал
      // перехватчик в api/client). Сеть моргнула — токены не трогаем.
      if (err.response?.status === 401) logout();
      else setUser(null);
      throw err;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchUser()
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (token, refreshToken) => {
    setTokens(token, refreshToken);
    const userData = await fetchUser();
    return userData;
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  const isAdmin = () => {
    return user && (user.role === 'admin');
  };

  const isMerchant = () => {
    return user && (user.role === 'merchant');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isMerchant, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
