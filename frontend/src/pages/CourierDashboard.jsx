import { useEffect, useState, useCallback, useRef } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api, { apiError } from '../api/client.js';
import CourierShell from '../components/CourierShell.jsx';
import { MapPinIcon, BoxIcon } from '../components/icons.jsx';
import { getSocket } from '../lib/socket.js';

const LIVE_STATUSES = ['COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'];

const STATUS_STYLE = {
  READY: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  COURIER_ASSIGNED: 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-400',
  PICKED_UP: 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-400',
  ON_THE_WAY: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  DELIVERED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};

// Courier-driven next step for an active delivery.
const NEXT = {
  COURIER_ASSIGNED: 'PICKED_UP',
  PICKED_UP: 'ON_THE_WAY',
  ON_THE_WAY: 'DELIVERED',
};

export default function CourierDashboard() {
  const { t, lang } = useI18n();
  const { user } = useAuth();

  const [status, setStatus] = useState(user?.courier?.status || 'OFFLINE');
  const [transport, setTransport] = useState(user?.courier?.transport || null);
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [geo, setGeo] = useState('off'); // off | sharing | denied | unavailable

  const online = status === 'ONLINE';

  const load = useCallback(async () => {
    const reqs = [api.get('/courier/orders')];
    if (online) reqs.push(api.get('/courier/orders/available'));
    const [mineRes, availRes] = await Promise.all(reqs);
    setMine(mineRes.data.orders);
    setAvailable(availRes ? availRes.data.orders : []);
  }, [online]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await api.get('/courier/me');
        if (!active) return;
        setStatus(me.data.courier.status);
        setTransport(me.data.courier.transport);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (active) setError(apiError(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    const id = setInterval(() => load().catch(() => {}), 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [load]);

  async function toggleOnline() {
    const next = online ? 'OFFLINE' : 'ONLINE';
    setError('');
    try {
      const { data } = await api.patch('/courier/status', { status: next });
      setStatus(data.courier.status);
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function claim(id) {
    setBusyId(id);
    setError('');
    try {
      await api.post(`/courier/orders/${id}/claim`);
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusyId('');
    }
  }

  async function advance(id, next) {
    setBusyId(id);
    setError('');
    try {
      await api.patch(`/courier/orders/${id}/status`, { status: next });
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusyId('');
    }
  }

  const activeMine = mine.filter((o) => o.status !== 'DELIVERED');
  const doneMine = mine.filter((o) => o.status === 'DELIVERED');

  // Share live GPS while there are in-progress deliveries. The latest set of
  // active order ids is read via a ref so the single watcher always emits for
  // the current deliveries without re-subscribing on every poll.
  const trackingIds = mine.filter((o) => LIVE_STATUSES.includes(o.status)).map((o) => o.id);
  const trackingKey = trackingIds.join(',');
  const trackingIdsRef = useRef(trackingIds);
  trackingIdsRef.current = trackingIds;

  useEffect(() => {
    if (!trackingKey) {
      setGeo('off');
      return;
    }
    if (!('geolocation' in navigator)) {
      setGeo('unavailable');
      return;
    }
    const socket = getSocket();
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeo('sharing');
        const { latitude: lat, longitude: lng } = pos.coords;
        for (const id of trackingIdsRef.current) socket.emit('location:update', { orderId: id, lat, lng });
      },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackingKey]);

  return (
    <CourierShell>
      {/* Availability */}
      <section className="mb-5 flex items-center justify-between rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
        <div>
          <div className="font-display text-[15px] font-bold">
            {online ? t('courierOnline') : t('courierOffline')}
          </div>
          <div className="text-[12.5px] text-[color:var(--muted)]">
            {transport ? t(`transport${transport}`) : t('courierNoTransport')}
          </div>
        </div>
        <button
          onClick={toggleOnline}
          className={`relative h-8 w-14 rounded-full transition-colors ${online ? 'bg-ember' : 'bg-[color:var(--line)]'}`}
          aria-label={online ? t('goOffline') : t('goOnline')}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${online ? 'left-7' : 'left-1'}`}
          />
        </button>
      </section>

      {geo !== 'off' && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold ${
            geo === 'sharing'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${geo === 'sharing' ? 'animate-pulse bg-emerald-500' : 'bg-amber-500'}`} />
          {geo === 'sharing' ? t('geoSharing') : geo === 'denied' ? t('geoDenied') : t('geoUnavailable')}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-ember/10 px-3 py-2.5 text-[13px] font-medium text-ember-dark">{error}</div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>
      ) : (
        <>
          {/* Active deliveries */}
          <SectionTitle>{t('myDeliveries')}</SectionTitle>
          {activeMine.length === 0 ? (
            <Empty>{t('noActiveDeliveries')}</Empty>
          ) : (
            <div className="mb-6 space-y-3">
              {activeMine.map((o) => (
                <OrderCard key={o.id} order={o} lang={lang} t={t}>
                  {NEXT[o.status] && (
                    <button
                      onClick={() => advance(o.id, NEXT[o.status])}
                      disabled={busyId === o.id}
                      className="btn-primary mt-3"
                    >
                      {busyId === o.id ? t('loading') : t(`courierAct${NEXT[o.status]}`)}
                    </button>
                  )}
                </OrderCard>
              ))}
            </div>
          )}

          {/* Available to claim */}
          <SectionTitle>{t('availableOrders')}</SectionTitle>
          {!online ? (
            <Empty>{t('goOnlineToSee')}</Empty>
          ) : available.length === 0 ? (
            <Empty>{t('noAvailableOrders')}</Empty>
          ) : (
            <div className="mb-6 space-y-3">
              {available.map((o) => (
                <OrderCard key={o.id} order={o} lang={lang} t={t}>
                  <button
                    onClick={() => claim(o.id)}
                    disabled={busyId === o.id}
                    className="btn-primary mt-3"
                  >
                    {busyId === o.id ? t('loading') : t('claimOrder')}
                  </button>
                </OrderCard>
              ))}
            </div>
          )}

          {/* Completed today */}
          {doneMine.length > 0 && (
            <>
              <SectionTitle>{t('deliveredHistory')}</SectionTitle>
              <div className="space-y-3">
                {doneMine.map((o) => (
                  <OrderCard key={o.id} order={o} lang={lang} t={t} muted />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </CourierShell>
  );
}

function OrderCard({ order, lang, t, children, muted }) {
  return (
    <div className={`rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card ${muted ? 'opacity-70' : ''}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 font-display text-[15px] font-bold">
          <BoxIcon className="h-4 w-4 text-ember" />
          {order.cook?.name}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[order.status] || 'bg-[color:var(--line)]'}`}>
          {t(`st${order.status}`)}
        </span>
      </div>

      <div className="mb-2 flex items-start gap-1.5 text-[13px] text-[color:var(--muted)]">
        <MapPinIcon className="mt-px h-4 w-4 shrink-0" />
        <span>{order.addressText}</span>
      </div>
      {order.buyer && (
        <div className="mb-2 text-[13px] text-[color:var(--muted)]">
          {order.buyer.name} · {order.buyer.phone}
        </div>
      )}
      {order.scheduledFor && (
        <div className="mb-2 text-[12.5px] text-[color:var(--muted)]">
          {t('deliveryTime')}:{' '}
          {new Date(order.scheduledFor).toLocaleString(lang === 'en' ? 'en-GB' : 'uk-UA', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}

      <div className="space-y-0.5 border-t border-[color:var(--line)] pt-2">
        {order.items.map((it) => (
          <div key={it.id} className="flex justify-between text-[13px]">
            <span>
              {it.name} <span className="text-[color:var(--muted)]">× {it.quantity}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-display text-[15px] font-bold">{order.total}₴</div>

      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="mb-2.5 text-[12px] font-bold uppercase tracking-wide text-[color:var(--muted)]">{children}</h2>;
}

function Empty({ children }) {
  return (
    <div className="mb-6 rounded-card border border-dashed border-[color:var(--line)] px-4 py-8 text-center text-[13px] text-[color:var(--muted)]">
      {children}
    </div>
  );
}
