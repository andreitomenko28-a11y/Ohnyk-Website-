import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import StarRating from '../components/StarRating.jsx';
import { Star } from '../components/icons.jsx';

const STATUS_STYLE = {
  AWAITING_PAYMENT: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  NEW: 'bg-ember/15 text-ember',
  CONFIRMED: 'bg-ember/15 text-ember',
  PREPARING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  READY: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  COURIER_ASSIGNED: 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-400',
  PICKED_UP: 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-400',
  ON_THE_WAY: 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-400',
  DELIVERED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  CANCELLED: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

const ACTIVE = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'];
const FILTERS = ['ALL', 'ACTIVE', 'DELIVERED', 'CANCELLED'];

export default function OrdersPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(data.orders);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Light polling so a status change surfaces without a manual refresh.
    const id = setInterval(() => load().catch(() => {}), 20000);
    return () => clearInterval(id);
  }, [load]);

  const shown = orders.filter((o) => {
    if (filter === 'ALL') return o.status !== 'AWAITING_PAYMENT';
    if (filter === 'ACTIVE') return ACTIVE.includes(o.status);
    return o.status === filter;
  });

  return (
    <div className="relative lg:mx-auto lg:max-w-[680px]">
      <header className="px-5 pb-2 pt-5">
        <div className="font-display text-2xl font-bold">{t('myOrders')}</div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-5 pb-3">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              filter === f ? 'bg-ember text-on-accent' : 'border border-[color:var(--line)] text-[color:var(--muted)]'
            }`}
          >
            {t(`ordersFilter_${f}`)}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-5 pb-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-[color:var(--muted)]">{error}</div>
        ) : shown.length === 0 ? (
          <div className="rounded-card border border-dashed border-[color:var(--line)] px-4 py-12 text-center text-[13px] text-[color:var(--muted)]">
            {t('noOrders')}
          </div>
        ) : (
          shown.map((o) => (
            <button
              key={o.id}
              onClick={() => navigate(`/orders/${o.id}`)}
              className="block w-full rounded-card border border-[color:var(--line)] bg-surface p-4 text-left shadow-card transition-colors hover:border-ember/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-display text-[15px] font-bold">{o.cook?.name}</div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[o.status] || ''}`}>
                  {t(`st${o.status}`)}
                </span>
              </div>
              <div className="mt-1 text-[12.5px] text-[color:var(--muted)]">
                {new Date(o.createdAt).toLocaleString(lang === 'en' ? 'en-GB' : 'uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {' · '}
                {t(`method_${o.deliveryMethod || 'COURIER'}`)}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="truncate text-[13px] text-[color:var(--muted)]">
                  {o.items.map((it) => `${it.name}×${it.quantity}`).join(', ')}
                </div>
                <div className="shrink-0 pl-3 font-display text-[15px] font-bold">{o.total}₴</div>
              </div>
              {o.review ? (
                <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--muted)]">
                  <StarRating value={o.review.rating} size="h-3.5 w-3.5" />
                </div>
              ) : (
                o.canReview && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-ember/10 px-2 py-1 text-[11.5px] font-semibold text-ember">
                    <Star className="h-3.5 w-3.5" /> {t('reviewHint')}
                  </div>
                )
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
