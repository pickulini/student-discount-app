import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Card, Button, Input, Textarea, Eyebrow } from '../design/UI';
import { RouteLoadingView } from '../design/DottedPath';

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

  if (loading) return <RouteLoadingView label="Загрузка..." />;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-editorial text-2xl text-ink uppercase">Поддержка</h2>
        <Button onClick={() => setShowCreate(true)}>Создать обращение</Button>
      </div>

      {showCreate && (
        <Card className="p-4 mb-4">
          <Eyebrow className="mb-2">Новое обращение</Eyebrow>
          <form onSubmit={handleCreateTicket} className="space-y-2">
            <Input
              type="text"
              placeholder="Тема"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              required
            />
            <Textarea
              placeholder="Сообщение"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows="3"
              required
            />
            <div className="flex gap-2">
              <Button type="submit">Отправить</Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Отмена</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1 p-3">
          <Eyebrow className="mb-2">Ваши обращения</Eyebrow>
          {tickets.length === 0 ? (
            <p className="text-ink-soft text-sm">Нет обращений</p>
          ) : (
            <ul className="divide-y divide-line">
              {tickets.map(t => (
                <li
                  key={t.id}
                  onClick={() => openTicket(t)}
                  className={`py-2 cursor-pointer hover:bg-surface-2 px-2 rounded-[var(--radius-sm)] transition ${selectedTicket?.id === t.id ? 'bg-surface-2' : ''}`}
                >
                  <div className="font-medium text-sm text-ink">{t.subject}</div>
                  <div className="text-xs text-ink-faint">Статус: {t.status}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="md:col-span-2 p-3">
          {selectedTicket ? (
            <>
              <h4 className="font-semibold text-ink mb-2">{selectedTicket.subject}</h4>
              <div className="border border-line rounded-[var(--radius-sm)] p-3 h-64 overflow-y-auto bg-surface-2">
                {messages.map(m => (
                  <div key={m.id} className={`mb-2 ${m.user_id === user.id ? 'text-right' : ''}`}>
                    <div className={`inline-block p-2 rounded-[var(--radius-sm)] ${m.user_id === user.id ? 'bg-accent/10 text-ink' : 'bg-surface text-ink'}`}>
                      <div className="text-sm">{m.message}</div>
                      <div className="text-xs text-ink-faint">{new Date(m.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
                <Input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Введите сообщение..."
                  className="flex-1"
                />
                <Button type="submit">Отправить</Button>
              </form>
            </>
          ) : (
            <p className="text-ink-soft text-center py-8">Выберите обращение</p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Support;
