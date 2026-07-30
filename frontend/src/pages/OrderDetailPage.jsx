import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import OrderStatusStepper from '../components/OrderStatusStepper.jsx';
import ReviewCard from '../components/ReviewCard.jsx';
import OrderChat from '../components/OrderChat.jsx';

const LIVE = ['COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'];

export default function OrderDetailPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, 15000);
    return () => clearInterval(timer);
  }, [reload]);

  if (loading) return <div className="py-16 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>;
  if (error || !order) return <div className="py-16 text-center text-sm text-[color:var(--muted)]">{error || t('error')}</div>;

  const canTrack = LIVE.includes(order.status) && order.deliveryMethod !== 'PICKUP';

  return (
    <div className="relative lg:mx-auto lg:max-w-[600px]">
      <header className="flex items-center gap-3 px-5 pb-3 pt-5">
        <button onClick={() => navigate('/orders')} className="text-[color:var(--muted)] hover:text-fg" aria-label={t('back')}>
          ‹
        </button>
        <div className="font-display text-xl font-bold">{t('orderTitle')}</div>
      </header>

      <div className="space-y-4 px-5 pb-6">
        {/* Progress */}
        <section className="rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-[15px] font-bold">{order.cook?.name}</span>
            <span className="text-[12.5px] text-[color:var(--muted)]">
              {new Date(order.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          </div>
          <OrderStatusStepper deliveryMethod={order.deliveryMethod} status={order.status} timeline={order.timeline} />
          <div className="mt-4 flex flex-wrap gap-2">
            {canTrack && (
              <button onClick={() => navigate(`/track/${order.id}`)} className="btn-primary !w-auto !px-5">
                {t('trackOrder')}
              </button>
            )}
            {/* The chat opens on payment (the server refuses to create one for
                an unpaid order), so the button is not offered before then. */}
            {order.status !== 'AWAITING_PAYMENT' && (
              <button
                onClick={() => setChatOpen(true)}
                className="rounded-xl border-[1.5px] border-[color:var(--line)] px-5 py-3 text-sm font-semibold hover:border-ember hover:text-ember"
              >
                {t('chatOpen')}
              </button>
            )}
          </div>
        </section>

        {/* Delivery */}
        <section className="rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
          <div className="mb-1 flex justify-between text-[13px]">
            <span className="text-[color:var(--muted)]">{t('deliveryMethod')}</span>
            <span className="font-semibold">{t(`method_${order.deliveryMethod || 'COURIER'}`)}</span>
          </div>
          <div className="text-[13px] text-[color:var(--muted)]">
            {order.deliveryMethod === 'PICKUP' ? `${t('pickupPoint')}: ${order.addressText}` : order.addressText}
          </div>
          {order.scheduledFor && (
            <div className="mt-1 text-[13px] text-[color:var(--muted)]">
              {t('deliveryTime')}: {new Date(order.scheduledFor).toLocaleString(lang === 'en' ? 'en-GB' : 'uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          {order.courier && (
            <div className="mt-2 text-[13px]">
              <span className="font-semibold">{t('trackCourier')}:</span> {order.courier.name}
              {order.courier.phone && <span className="text-[color:var(--muted)]"> · {order.courier.phone}</span>}
            </div>
          )}
        </section>

        {/* Items + pricing */}
        <section className="rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
          <div className="space-y-1">
            {order.items.map((it) => (
              <div key={it.id} className="flex justify-between text-[13.5px]">
                <span>
                  {it.name} <span className="text-[color:var(--muted)]">× {it.quantity}</span>
                </span>
                <span className="font-medium">{it.lineTotal}₴</span>
              </div>
            ))}
          </div>
          <div className="my-3 h-px bg-[color:var(--line)]" />
          <Row label={t('subtotal')} value={order.subtotal} muted />
          {order.serviceFee > 0 && <Row label={t('serviceFee')} value={order.serviceFee} muted />}
          <div className="mt-1 flex justify-between text-[15px] font-bold">
            <span>{t('toPay')}</span>
            <span>{order.total}₴</span>
          </div>
        </section>

        {order.note && (
          <div className="rounded-lg bg-elevated px-3 py-2.5 text-[12.5px] text-[color:var(--muted)]">
            {t('orderNote')}: {order.note}
          </div>
        )}

        {/* Review (delivered orders only). Keyed on the review so an external
            change (poll refetch / another tab) re-initialises the form state. */}
        {order.status === 'DELIVERED' && (
          <ReviewCard
            key={order.review?.id || 'new'}
            orderId={order.id}
            review={order.review}
            cookName={order.cook?.name}
            onChange={reload}
          />
        )}
      </div>

      {chatOpen && <OrderChat orderId={order.id} title={t('chatTitleBuyer')} onClose={() => setChatOpen(false)} />}
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className={`flex justify-between text-[13px] ${muted ? 'text-[color:var(--muted)]' : ''}`}>
      <span>{label}</span>
      <span className={muted ? 'font-medium text-fg' : 'font-semibold'}>{value}₴</span>
    </div>
  );
}
