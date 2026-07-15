import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import { getSocket } from '../lib/socket.js';
import TrackingMap from '../components/TrackingMap.jsx';

const LIVE_STATUSES = ['COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'];

export default function TrackPage() {
  const { orderId } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState(null);
  const [loc, setLoc] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const joinedRef = useRef(false);

  // Load the order (address, courier, method, status).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get(`/orders/${orderId}`);
        if (!active) return;
        setOrder(data.order);
        setStatus(data.order.status);
      } catch (err) {
        if (active) setError(apiError(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [orderId]);

  // Join the authorized tracking room and listen for live updates.
  useEffect(() => {
    const socket = getSocket();
    const join = () => {
      socket.emit('track:join', orderId, (res) => {
        joinedRef.current = true;
        if (res?.ok) {
          if (res.status) setStatus(res.status);
          if (res.location) setLoc(res.location);
        }
      });
    };
    const onLoc = (m) => {
      if (m.orderId === orderId) setLoc({ lat: m.lat, lng: m.lng, updatedAt: m.updatedAt });
    };

    socket.on('location:update', onLoc);
    if (socket.connected) join();
    else socket.on('connect', join);

    return () => {
      socket.off('location:update', onLoc);
      socket.off('connect', join);
      if (joinedRef.current) socket.emit('track:leave', orderId);
    };
  }, [orderId]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>;
  }
  if (error || !order) {
    return <div className="py-16 text-center text-sm text-[color:var(--muted)]">{error || t('error')}</div>;
  }

  const isLive = LIVE_STATUSES.includes(status);
  const done = status === 'DELIVERED';
  const destination = order.deliveryLat != null && order.deliveryLng != null
    ? { lat: order.deliveryLat, lng: order.deliveryLng }
    : null;

  return (
    <div className="relative lg:mx-auto lg:max-w-[600px]">
      <header className="flex items-center gap-3 px-5 pb-3 pt-5">
        <button onClick={() => navigate(-1)} className="text-[color:var(--muted)] hover:text-fg" aria-label={t('back')}>
          ‹
        </button>
        <div className="font-display text-xl font-bold">{t('trackTitle')}</div>
      </header>

      <div className="space-y-4 px-5 pb-6">
        {/* Status + courier */}
        <section className="rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-display text-[15px] font-bold">{t(`st${status}`)}</span>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                {t('liveNow')}
              </span>
            )}
          </div>
          <div className="text-[13px] text-[color:var(--muted)]">{order.cook?.name}</div>
          {order.courier ? (
            <div className="mt-2 text-[13.5px]">
              <span className="font-semibold">{t('trackCourier')}:</span> {order.courier.name}
              {order.courier.phone && <span className="text-[color:var(--muted)]"> · {order.courier.phone}</span>}
            </div>
          ) : (
            <div className="mt-2 text-[13px] text-[color:var(--muted)]">{t('trackNoCourier')}</div>
          )}
          <div className="mt-1 text-[13px] text-[color:var(--muted)]">{order.addressText}</div>
        </section>

        {/* Map */}
        <section className="overflow-hidden rounded-card border border-[color:var(--line)] bg-surface shadow-card">
          <div className="relative h-[320px] w-full">
            <TrackingMap courier={loc} destination={destination} />
            {!loc && (
              <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-surface/70 px-6 text-center text-[13px] font-medium text-[color:var(--muted)] backdrop-blur-sm">
                {done ? t('trackDelivered') : isLive ? t('trackWaiting') : t('trackNotLive')}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
