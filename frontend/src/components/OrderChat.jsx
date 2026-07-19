import { useEffect, useRef, useState, useCallback } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api, { apiError } from '../api/client.js';
import { getSocket } from '../lib/socket.js';

// Minimal in-app chat for one order (Module 6.1). History via REST; new
// messages delivered live over the shared socket.io connection.
export default function OrderChat({ orderId, title, onClose }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [convId, setConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  // Append while de-duplicating by id (REST echo + socket broadcast overlap).
  const addMessage = useCallback((msg) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }, []);

  useEffect(() => {
    let active = true;
    let socket;
    let cid;
    (async () => {
      try {
        const { data: c } = await api.get(`/orders/${orderId}/conversation`);
        if (!active) return;
        cid = c.conversation.id;
        setConvId(cid);
        const { data: h } = await api.get(`/conversations/${cid}/messages`);
        if (!active) return;
        setMessages(h.messages);

        socket = getSocket();
        socket.emit('chat:join', cid);
        socket.on('chat:message', onSocket);
        // mark the other party's messages read on open
        api.post(`/conversations/${cid}/read`).catch(() => {});
      } catch (err) {
        if (active) setError(apiError(err));
      } finally {
        if (active) setLoading(false);
      }
    })();

    function onSocket(payload) {
      if (payload?.conversationId === cid) addMessage(payload.message);
    }

    return () => {
      active = false;
      if (socket) {
        socket.emit('chat:leave', cid);
        socket.off('chat:message', onSocket);
      }
    };
  }, [orderId, addMessage]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !convId || sending) return;
    setSending(true);
    setError('');
    try {
      const { data } = await api.post(`/conversations/${convId}/messages`, { text: body });
      addMessage(data.message); // instant echo; socket event is de-duped
      setText('');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="flex h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-card border border-[color:var(--line)] bg-surface shadow-card sm:h-[70vh] sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-3">
          <h2 className="font-display text-[16px] font-bold">{title}</h2>
          <button onClick={onClose} className="text-[color:var(--muted)] hover:text-fg">✕</button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="py-10 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>
          ) : messages.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[color:var(--muted)]">{t('chatEmpty')}</div>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === user.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-3 py-2 text-[14px] ${
                      mine ? 'bg-ember text-on-accent' : 'bg-elevated text-fg'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                    <div className={`mt-0.5 text-[10.5px] ${mine ? 'text-on-accent/70' : 'text-[color:var(--muted)]'}`}>
                      {new Date(m.createdAt).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'uk-UA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {error && <div className="px-4 pb-1 text-[12.5px] text-red-500">{error}</div>}

        <form onSubmit={send} className="flex items-center gap-2 border-t border-[color:var(--line)] p-3">
          <input
            className="field-input !mt-0 flex-1"
            placeholder={t('chatPlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="btn-primary !mt-0 !w-auto !px-4 disabled:opacity-50"
          >
            {t('chatSend')}
          </button>
        </form>
      </div>
    </div>
  );
}
