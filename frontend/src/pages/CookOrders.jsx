import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import CookShell from '../components/CookShell.jsx';
import { CartIcon } from '../components/icons.jsx';

// Cook-actionable next statuses (mirrors the backend). After READY a courier
// takes over the delivery statuses.
const NEXT = {
  NEW: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: [],
};

// Badge style for every order status (delivery statuses are read-only here).
const STATUS_STYLE = {
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

const FILTERS = ['ALL', 'NEW', 'PREPARING', 'READY', 'DELIVERED'];

export default function CookOrders() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const verified = user?.cook?.verificationStatus === 'VERIFIED';

  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(verified);

  const load = useCallback(async () => {
    const [o, s] = await Promise.all([api.get('/cook/orders'), api.get('/cook/stats')]);
    setOrders(o.data.orders);
    setStats(s.data);
  }, []);

  useEffect(() => {
    if (!verified) return;
    let active = true;
    (async () => {
      try {
        await load();
      } finally {
        if (active) setLoading(false);
      }
    })();
    // Light polling so new orders surface without a manual refresh.
    const id = setInterval(() => load().catch(() => {}), 20000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [verified, load]);

  if (!verified) {
    return (
      <CookShell>
        <div className="rounded-card border border-dashed border-[color:var(--line)] bg-surface p-8 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-elevated text-[color:var(--muted)]">
            <CartIcon className="h-6 w-6" />
          </span>
          <h2 className="font-display text-[17px] font-bold">{t('ordersLocked')}</h2>
          <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-[color:var(--muted)]">{t('menuLockedHint')}</p>
          <Link to="/cook" className="btn-primary mx-auto mt-5 !w-auto !px-5 inline-block">
            {t('toProfile')}
          </Link>
        </div>
      </CookShell>
    );
  }

  const shown = filter === 'ALL' ? orders : orders.filter((o) => o.status === filter);

  return (
    <CookShell>
      <h1 className="mb-4 font-display text-[22px] font-bold">{t('ordersTitle')}</h1>

      {stats && <StatsRow stats={stats} t={t} />}

      {/* Filters */}
      <div className="mb-4 mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              filter === f ? 'bg-ember text-[color:var(--on-accent)]' : 'bg-elevated text-[color:var(--muted)]'
            }`}
          >
            {f === 'ALL' ? t('filterAll') : t(`st${f}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-[color:var(--muted)]">…</div>
      ) : shown.length === 0 ? (
        <div className="rounded-card border border-dashed border-[color:var(--line)] bg-surface p-8 text-center">
          <h2 className="font-display text-[16px] font-bold">{t('noOrders')}</h2>
          <p className="mt-1 text-[13.5px] text-[color:var(--muted)]">{t('noOrdersHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((o) => (
            <OrderCard key={o.id} order={o} t={t} lang={lang} onChanged={load} />
          ))}
        </div>
      )}
    </CookShell>
  );
}

function StatsRow({ stats, t }) {
  const tiles = [
    { label: t('statNew'), value: stats.newCount },
    { label: t('statToday'), value: stats.ordersToday },
    { label: t('statRevenueToday'), value: `${stats.revenueToday} ₴` },
    { label: t('statRevenueTotal'), value: `${stats.revenueTotal} ₴` },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-card border border-[color:var(--line)] bg-surface p-3.5">
            <div className="font-display text-[22px] font-bold">{tile.value}</div>
            <div className="mt-0.5 text-[12px] text-[color:var(--muted)]">{tile.label}</div>
          </div>
        ))}
      </div>
      {stats.topDishes?.length > 0 && (
        <div className="mt-3 rounded-card border border-[color:var(--line)] bg-surface p-3.5">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            {t('topDishesTitle')}
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.topDishes.map((d) => (
              <span key={d.name} className="rounded-full bg-elevated px-2.5 py-1 text-[12.5px]">
                {d.name} · <span className="font-bold text-ember">{d.qty}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function OrderCard({ order, t, lang, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function advance(status) {
    setErr('');
    setBusy(true);
    try {
      await api.patch(`/cook/orders/${order.id}/status`, { status });
      await onChanged();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      // Always clear busy: the card keeps its identity (keyed by order id)
      // after a reload, so leaving busy=true would freeze its buttons.
      setBusy(false);
    }
  }

  const time = new Date(order.createdAt).toLocaleString(lang === 'en' ? 'en-GB' : 'uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-[15px] font-bold">{order.buyer?.name}</div>
          <div className="text-[12px] text-[color:var(--muted)]">{time}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${STATUS_STYLE[order.status]}`}>
          {t(`st${order.status}`)}
        </span>
      </div>

      <div className="mt-2 text-[13px] text-[color:var(--muted)]">{order.addressText}</div>
      {order.buyer?.phone && <div className="text-[13px] text-[color:var(--muted)]">{order.buyer.phone}</div>}

      <div className="mt-3 space-y-1 border-t border-[color:var(--line)] pt-3">
        {order.items.map((i) => (
          <div key={i.id} className="flex justify-between text-[13.5px]">
            <span>
              {i.name} <span className="text-[color:var(--muted)]">× {i.quantity}</span>
            </span>
            <span className="font-medium">{i.lineTotal} ₴</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-[color:var(--line)] pt-2 text-[14px] font-bold">
          <span>{order.total} ₴</span>
        </div>
      </div>

      {order.note && (
        <div className="mt-2 rounded-lg bg-elevated px-3 py-2 text-[12.5px] text-[color:var(--muted)]">
          {t('orderNote')}: {order.note}
        </div>
      )}

      {err && <p className="mt-2 text-[12.5px] text-red-500">{err}</p>}

      {NEXT[order.status]?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {NEXT[order.status].map((s) => (
            <button
              key={s}
              disabled={busy}
              onClick={() => advance(s)}
              className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
                s === 'CANCELLED'
                  ? 'border border-[color:var(--line)] text-red-500 hover:border-red-400'
                  : 'bg-gradient-to-br from-[color:var(--ember)] to-[color:var(--ember-dark)] text-[color:var(--on-accent)]'
              }`}
            >
              {t(`act${s}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
