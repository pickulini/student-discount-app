import React, { useState, useEffect } from 'react';
import api from '../api/client';
import UserStatsModal from './UserStatsModal';
import { useNotifications } from '../context/NotificationContext';

const AdminSupport = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [status, setStatus] = useState('');
  const [statsUserId, setStatsUserId] = useState(null);
  const { events, reconnectCount } = useNotifications(true);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/admin/support/tickets');
      setTickets(res.data || []);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId) => {
    try {
      const res = await api.get(`/support/tickets/${ticketId}/messages`);
      setMessages(res.data || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // realtime: support_message -> обновить открытый тикет и список
  useEffect(() => {
    if (!events.support_message) return;
    const payload = events.support_message.payload;
    if (selectedTicket && payload.ticket_id === selectedTicket.id) {
      fetchMessages(selectedTicket.id);
    }
    fetchTickets();
  }, [events.support_message]);

  // realtime: new_support_ticket -> обновить список
  useEffect(() => {
    if (!events.new_support_ticket) return;
    fetchTickets();
  }, [events.new_support_ticket]);

  // При переподключении SSE — перечитываем всё
  useEffect(() => {
    if (reconnectCount === 0) return;
    fetchTickets();
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
    }
  }, [reconnectCount]);

  const openTicket = (ticket) => {
    setSelectedTicket(ticket);
    setStatus(ticket.status);
    fetchMessages(ticket.id);
  };

  const handleUpdateStatus = async () => {
    if (!selectedTicket) return;
    try {
      await api.put(`/admin/support/tickets/${selectedTicket.id}/status`, { status });
      fetchTickets();
      setSelectedTicket({ ...selectedTicket, status });
    } catch (err) {
      alert('Ошибка обновления статуса');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket) return;
    try {
      await api.post(`/admin/support/tickets/${selectedTicket.id}/messages`, { message: newMessage });
      setNewMessage('');
      fetchMessages(selectedTicket.id);
    } catch (err) {
      alert('Ошибка отправки сообщения');
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Обращения в поддержку</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 bg-white rounded shadow p-3">
          <h4 className="font-semibold mb-2">Все обращения</h4>
          {tickets.length === 0 ? (
            <p className="text-gray-500 text-sm">Нет обращений</p>
          ) : (
            <ul className="divide-y">
              {tickets.map(t => (
                <li
                  key={t.id}
                  className={`py-2 px-2 rounded ${selectedTicket?.id === t.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <div
                    onClick={() => openTicket(t)}
                    className="cursor-pointer"
                  >
                    <div className="font-medium text-sm">{t.subject}</div>
                    <div className="text-xs text-gray-500">
                      Пользователь #{t.user_id} • Статус: {t.status}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-2 bg-white rounded shadow p-3">
          {selectedTicket ? (
            <>
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h4 className="font-semibold">{selectedTicket.subject}</h4>
                  <p className="text-xs text-gray-500">Пользователь #{selectedTicket.user_id}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatsUserId(selectedTicket.user_id)}
                    className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600"
                  >
                    📊 Статистика пользователя
                  </button>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="border rounded p-1 text-sm"
                  >
                    <option value="open">Открыт</option>
                    <option value="in_progress">В работе</option>
                    <option value="resolved">Решён</option>
                    <option value="closed">Закрыт</option>
                  </select>
                  <button
                    onClick={handleUpdateStatus}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                  >
                    Обновить статус
                  </button>
                </div>
              </div>

              <div className="border rounded p-3 h-64 overflow-y-auto bg-gray-50 mt-3">
                {messages.map(m => (
                  <div key={m.id} className={`mb-2 ${m.is_internal ? 'bg-yellow-50 border-l-4 border-yellow-400' : m.user_id === selectedTicket.user_id ? 'text-right' : ''}`}>
                    <div className={`inline-block p-2 rounded ${m.is_internal ? 'text-gray-600' : m.user_id === selectedTicket.user_id ? 'bg-blue-100' : 'bg-gray-200'}`}>
                      <div className="text-sm">{m.message}</div>
                      <div className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Ответ..."
                  className="flex-1 border p-2 rounded"
                />
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                  Отправить
                </button>
              </form>
            </>
          ) : (
            <p className="text-gray-500 text-center py-8">Выберите обращение</p>
          )}
        </div>
      </div>

      {/* Модалка статистики пользователя */}
      {statsUserId && (
        <UserStatsModal userId={statsUserId} onClose={() => setStatsUserId(null)} />
      )}
    </div>
  );
};

export default AdminSupport;
