import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import { BellIcon } from './icons.jsx';

// In-app notification centre (Module 6.3). A bell with an unread badge that
// opens a dropdown; new notifications arrive live over the shared socket.
export default function NotificationBell() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 20 } });
      setItems(data.notifications);
      setUnread(data.unreadCount);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    const onNew = (payload) => {
      if (!payload?.notification) return;
      setItems((prev) => [payload.notification, ...prev].slice(0, 30));
      setUnread((n) => n + 1);
    };
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function markAll() {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await api.post('/notifications/read-all').catch(() => {});
  }

  function destinationFor(n) {
    const isCook = user?.role === 'COOK';
    if (n.type === 'NEW_ORDER') return '/cook/orders';
    if (n.type === 'REVIEW_RECEIVED') return '/cook/reviews';
    // ORDER_STATUS / NEW_MESSAGE → the order
    if (n.payload?.orderId) return isCook ? '/cook/orders' : `/orders/${n.payload.orderId}`;
    return null;
  }

  async function openNotification(n) {
    setOpen(false);
    if (!n.read) {
      setUnread((c) => Math.max(0, c - 1));
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      api.patch(`/notifications/${n.id}/read`).catch(() => {});
    }
    const dest = destinationFor(n);
    if (dest) navigate(dest);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('notifTitle')}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-[color:var(--muted)] transition-colors hover:text-fg"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-ember px-1 text-[10px] font-bold text-on-accent">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[300px] overflow-hidden rounded-card border border-[color:var(--line)] bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] px-3 py-2">
            <span className="font-display text-[14px] font-bold">{t('notifTitle')}</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-[12px] font-semibold text-ember hover:underline">
                {t('notifMarkAll')}
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-8 text-center text-[13px] text-[color:var(--muted)]">{t('notifEmpty')}</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={`flex w-full items-start gap-2 border-b border-[color:var(--line)] px-3 py-2.5 text-left last:border-0 hover:bg-elevated ${
                    n.read ? '' : 'bg-ember/[0.04]'
                  }`}
                >
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ember" />}
                  <span className={`min-w-0 flex-1 ${n.read ? 'pl-4' : ''}`}>
                    <span className="block text-[13px] font-semibold">{n.payload?.title}</span>
                    {n.payload?.body && <span className="block truncate text-[12.5px] text-[color:var(--muted)]">{n.payload.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-[color:var(--muted)]">
                      {new Date(n.createdAt).toLocaleString(lang === 'en' ? 'en-GB' : 'uk-UA', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
