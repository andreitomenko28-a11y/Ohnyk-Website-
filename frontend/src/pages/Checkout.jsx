import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useCart } from '../context/CartContext.jsx';
import api, { apiError } from '../api/client.js';

export default function Checkout() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { cart, loading, refresh } = useCart();

  const [days, setDays] = useState([]);
  const [cookName, setCookName] = useState('');
  const [slot, setSlot] = useState(''); // '' = ASAP
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);

  const empty = !loading && cart.items.length === 0;

  // Redirect to the cart if it's empty (unless we're mid-checkout — the cart
  // empties the moment the order is created, just before we leave for payment).
  useEffect(() => {
    if (empty && !placing) navigate('/cart', { replace: true });
  }, [empty, placing, navigate]);

  // Load delivery slots + the cook's name for the summary.
  useEffect(() => {
    if (loading || cart.items.length === 0) return;
    let active = true;
    (async () => {
      try {
        const [slots, cook] = await Promise.all([
          api.get('/orders/delivery-slots'),
          cart.cookId ? api.get(`/cooks/${cart.cookId}`) : Promise.resolve(null),
        ]);
        if (!active) return;
        setDays(slots.data.days);
        if (cook) setCookName(cook.data.cook?.name || '');
      } catch {
        /* slots are optional — ASAP still works */
      }
    })();
    return () => {
      active = false;
    };
  }, [loading, cart.items.length, cart.cookId]);

  const dayLabel = useMemo(
    () => (dateStr) => {
      const d = new Date(`${dateStr}T00:00:00`);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diff = Math.round((d - today) / 86400000);
      if (diff === 0) return t('today');
      if (diff === 1) return t('tomorrow');
      return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'uk-UA', { weekday: 'short', day: '2-digit', month: '2-digit' });
    },
    [t, lang],
  );

  async function confirm() {
    setError('');
    setBusy(true);
    setPlacing(true);
    try {
      const payload = {};
      if (note.trim()) payload.note = note.trim();
      if (slot) payload.scheduledFor = slot;
      const { data } = await api.post('/orders', payload);
      await refresh(); // backend emptied the cart

      // Create a MonoPay invoice and hand off to the payment page/gateway.
      const { data: pay } = await api.post(`/orders/${data.order.id}/pay`);
      const url = new URL(pay.pageUrl, window.location.origin);
      if (url.origin === window.location.origin) {
        navigate(url.pathname); // stub gateway lives in this SPA
      } else {
        window.location.assign(pay.pageUrl); // hosted monobank page
      }
    } catch (err) {
      setError(apiError(err));
      setPlacing(false);
      setBusy(false);
    }
  }

  if (loading || empty) {
    return <div className="py-16 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>;
  }

  return (
    <div className="relative lg:mx-auto lg:max-w-[600px]">
      <header className="flex items-center gap-3 px-5 pb-3 pt-5">
        <button onClick={() => navigate('/cart')} className="text-[color:var(--muted)] hover:text-fg" aria-label={t('backToCart')}>
          ‹
        </button>
        <div className="font-display text-xl font-bold">{t('checkoutTitle')}</div>
      </header>

      <div className="space-y-4 px-5 pb-6">
        {/* Delivery time */}
        <section className="rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
          <h2 className="mb-3 font-display text-[15px] font-bold">{t('deliveryTime')}</h2>
          <button
            onClick={() => setSlot('')}
            className={`mb-3 w-full rounded-xl border px-3.5 py-3 text-left text-[14px] font-semibold transition-colors ${
              slot === '' ? 'border-ember bg-ember/[0.06] text-ember-dark' : 'border-[color:var(--line)]'
            }`}
          >
            {t('asap')}
          </button>

          {days.length === 0 ? (
            <p className="text-[13px] text-[color:var(--muted)]">{t('noSlots')}</p>
          ) : (
            <div className="space-y-3">
              {days.map((d) => (
                <div key={d.date}>
                  <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    {dayLabel(d.date)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {d.slots.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setSlot(s.value)}
                        className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                          slot === s.value ? 'border-ember bg-ember/10 text-ember' : 'border-[color:var(--line)] text-[color:var(--muted)]'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Comment */}
        <textarea
          className="field-input min-h-[64px] resize-y"
          placeholder={t('notePlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />

        {/* Summary */}
        <section className="rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
          <h2 className="mb-3 font-display text-[15px] font-bold">{t('orderSummary')}</h2>
          {cookName && <div className="mb-2 text-[13.5px] font-semibold">{cookName}</div>}
          <div className="space-y-1">
            {cart.items.map((it) => (
              <div key={it.id} className="flex justify-between text-[13.5px]">
                <span>
                  {it.dish.name} <span className="text-[color:var(--muted)]">× {it.quantity}</span>
                </span>
                <span className="font-medium">{it.lineTotal}₴</span>
              </div>
            ))}
          </div>
          <div className="my-3 h-px bg-[color:var(--line)]" />
          <div className="flex justify-between text-[13px] text-[color:var(--muted)]">
            <span>{t('deliveryTime')}</span>
            <span className="font-semibold text-fg">
              {slot ? new Date(slot).toLocaleString(lang === 'en' ? 'en-GB' : 'uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : t('asap')}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-[15px] font-bold">
            <span>{t('total')}</span>
            <span>{cart.subtotal}₴</span>
          </div>
        </section>

        {error && (
          <div className="rounded-lg bg-ember/10 px-3 py-2.5 text-[13px] font-medium text-ember-dark">{error}</div>
        )}

        <button onClick={confirm} disabled={busy} className="btn-primary">
          {busy ? t('loading') : t('confirmOrder')}
        </button>
      </div>
    </div>
  );
}
