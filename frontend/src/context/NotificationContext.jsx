import { freshAccessToken } from '../api/client';
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

const CUSTOM_EVENTS = [
  'support_message',
  'new_support_ticket',
  'offer_pending_review',
  'event_pending_review',
  'verification_pending',
];

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastNotification, setLastNotification] = useState(null);
  const [events, setEvents] = useState({});
  const [connected, setConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const esRef = useRef(null);
  const retryRef = useRef(0);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);
  const connectedRef = useRef(false);
  const connectCountRef = useRef(0);

  const fetchCount = useCallback(async () => {
    const token = await freshAccessToken();
    if (!token) return;
    try {
      const res = await fetch('/api/v1/notifications/unread/count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setConnected(false);
      connectedRef.current = false;
      connectCountRef.current = 0;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      return;
    }

    cancelledRef.current = false;

    const connect = async () => {
      if (cancelledRef.current) return;
      // Поток открывается с токеном в URL: берём свежий, иначе через полчаса
      // переподключение упиралось бы в просроченный токен.
      const token = await freshAccessToken();
      if (cancelledRef.current) return;
      if (!token) return;

      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      const url = `/api/v1/notifications/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener('connected', () => {
        const wasDisconnected = !connectedRef.current;
        const isReconnect = connectCountRef.current > 0;
        connectedRef.current = true;
        connectCountRef.current++;
        setConnected(true);
        retryRef.current = 0;
        fetchCount();
        // Инкрементим счётчик при реконнекте (не при первом подключении)
        if (wasDisconnected && isReconnect) {
          setReconnectCount((c) => c + 1);
        }
      });

      es.addEventListener('notification', (e) => {
        try {
          const n = JSON.parse(e.data);
          setLastNotification(n);
          setUnreadCount((c) => c + 1);
        } catch {}
      });

      CUSTOM_EVENTS.forEach((evt) => {
        es.addEventListener(evt, (e) => {
          try {
            const payload = JSON.parse(e.data);
            setEvents((prev) => ({ ...prev, [evt]: { payload, ts: Date.now() } }));
          } catch {}
        });
      });

      es.onerror = () => {
        connectedRef.current = false;
        setConnected(false);
        if (esRef.current === es) {
          es.close();
          esRef.current = null;
        }
        if (cancelledRef.current) return;

        // защита от двойного вызова onerror
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }

        // экспоненциальный backoff: 1s, 2s, 4s, ..., max 30s
        const delay = Math.min(1000 * Math.pow(2, retryRef.current), 30000);
        retryRef.current += 1;
        timerRef.current = setTimeout(connect, delay);
      };
    };

    connect();
    fetchCount();

    // Fallback: раз в 15 сек, если SSE не подключен — подтягиваем счётчик
    const pollTimer = setInterval(() => {
      if (!connectedRef.current && !cancelledRef.current) {
        fetchCount();
      }
    }, 15000);

    return () => {
      clearInterval(pollTimer);
      cancelledRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [user, fetchCount]);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, lastNotification, events, connected, reconnectCount, refreshCount: fetchCount }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // fallback: если провайдер не подключен — возвращаем пустышку
    return { unreadCount: 0, lastNotification: null, events: {}, connected: false, refreshCount: () => {} };
  }
  return ctx;
};
