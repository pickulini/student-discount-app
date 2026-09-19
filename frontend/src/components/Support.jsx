import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

const Support = () => {
  const { user } = useAuth();
  const { events, reconnectCount } = useNotifications(!!user);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const fetchTickets = async () => {
    try {
      const res = await api.get('/support/tickets');
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

  // realtime: при новом сообщении по нашему тикету перечитываем
  useEffect(() => {
    if (!events.support_message) return;
    const payload = events.support_message.payload;
    if (selectedTicket && payload.ticket_id === selectedTicket.id) {
      fetchMessages(selectedTicket.id);
    }
    fetchTickets();
  }, [events.support_message]);

  // При переподключении SSE — перечитываем всё
  useEffect(() => {
    if (reconnectCount === 0) return;
    fetchTickets();
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
    }
  }, [reconnectCount]);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    try {
      await api.post('/support/tickets', { subject, first_message: message });
      setSubject('');
      setMessage('');
      setShowCreate(false);
      fetchTickets();
    } catch (err) {
      alert('Ошибка создания тикета');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket) return;
    try {
      await api.post(`/support/tickets/${selectedTicket.id}/messages`, { message: newMessage });
      setNewMessage('');
      fetchMessages(selectedTicket.id);
    } catch (err) {
      alert('Ошибка отправки сообщения');
    }
  };

  const openTicket = (ticket) => {
    setSelectedTicket(ticket);
    fetchMessages(ticket.id);
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Поддержка</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Создать обращение
        </button>
      </div>

      {showCreate && (
        <div className="bg-white p-4 rounded shadow mb-4">
          <h3 className="text-lg font-semibold mb-2">Новое обращение</h3>
          <form onSubmit={handleCreateTicket}>
            <input
              type="text"
              placeholder="Тема"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full border p-2 rounded mb-2"
              required
            />
            <textarea
              placeholder="Сообщение"
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full border p-2 rounded mb-2"
              rows="3"
              required
            />
            <div className="flex gap-2">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Отправить</button>
              <button type="button" onClick={() => setShowCreate(false)} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Отмена</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 bg-white rounded shadow p-3">
          <h4 className="font-semibold mb-2">Ваши обращения</h4>
          {tickets.length === 0 ? (
            <p className="text-gray-500 text-sm">Нет обращений</p>
          ) : (
            <ul className="divide-y">
              {tickets.map(t => (
                <li
                  key={t.id}
                  onClick={() => openTicket(t)}
                  className={`py-2 cursor-pointer hover:bg-gray-50 px-2 rounded ${selectedTicket?.id === t.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="font-medium text-sm">{t.subject}</div>
                  <div className="text-xs text-gray-500">Статус: {t.status}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="md:col-span-2 bg-white rounded shadow p-3">
          {selectedTicket ? (
            <>
              <h4 className="font-semibold mb-2">{selectedTicket.subject}</h4>
              <div className="border rounded p-3 h-64 overflow-y-auto bg-gray-50">
                {messages.map(m => (
                  <div key={m.id} className={`mb-2 ${m.user_id === user.id ? 'text-right' : ''}`}>
                    <div className={`inline-block p-2 rounded ${m.user_id === user.id ? 'bg-blue-100' : 'bg-gray-200'}`}>
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
                  placeholder="Введите сообщение..."
                  className="flex-1 border p-2 rounded"
                />
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Отправить</button>
              </form>
            </>
          ) : (
            <p className="text-gray-500 text-center py-8">Выберите обращение</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Support;
