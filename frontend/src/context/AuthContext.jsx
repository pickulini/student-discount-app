import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/client';

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
      console.error('Failed to fetch user:', err);
      logout();
      throw err;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (token) => {
    localStorage.setItem('access_token', token);
    const userData = await fetchUser();
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
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
