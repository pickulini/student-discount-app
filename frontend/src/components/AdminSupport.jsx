import React, { useState, useEffect } from 'react';
import api from '../api/client';

const AdminSupport = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [status, setStatus] = useState('');

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
              <div className="flex justify-between items-center">
                <h4 className="font-semibold">{selectedTicket.subject}</h4>
                <div className="flex gap-2">
                  <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded p-1 text-sm">
                    <option value="open">Открыт</option>
                    <option value="in_progress">В работе</option>
                    <option value="resolved">Решён</option>
                    <option value="closed">Закрыт</option>
                  </select>
                  <button onClick={handleUpdateStatus} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">Обновить статус</button>
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
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Отправить</button>
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

export default AdminSupport;
