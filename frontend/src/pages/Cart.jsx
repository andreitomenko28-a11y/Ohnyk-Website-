import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useCart } from '../context/CartContext.jsx';
import api, { apiError } from '../api/client.js';
import CartItem from '../components/CartItem.jsx';
import CartSummary from '../components/CartSummary.jsx';
import { CartIcon } from '../components/icons.jsx';

export default function Cart() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { cart, loading, clear, refresh } = useCart();

  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState(null);

  const empty = cart.items.length === 0;

  async function checkout() {
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/orders', note.trim() ? { note: note.trim() } : {});
      await refresh(); // backend emptied the cart
      setPlaced(data.order);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  // Order confirmation.
  if (placed) {
    return (
      <div className="relative lg:mx-auto lg:max-w-[760px]">
        <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
          <span className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <div className="mb-1 font-display text-xl font-bold">{t('orderPlaced')}</div>
          <div className="mb-2 max-w-sm text-sm text-[color:var(--muted)]">{t('orderPlacedHint')}</div>
          <div className="mb-6 text-sm font-semibold">
            {placed.cook?.name} · {placed.total}₴
          </div>
          <button onClick={() => navigate('/discovery')} className="btn-primary max-w-[220px]">
            {t('keepShopping')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative lg:mx-auto lg:max-w-[760px]">
      <header className="flex items-center justify-between bg-canvas px-5 pb-3 pt-5">
        <div className="font-display text-xl font-bold">{t('cartTitle')}</div>
        {!empty && (
          <button onClick={clear} className="text-[13px] font-semibold text-[color:var(--muted)]">
            {t('clearCart')}
          </button>
        )}
      </header>

      {loading ? (
        <div className="py-16 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>
      ) : empty ? (
        <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
          <CartIcon className="mb-4 h-14 w-14 text-[color:var(--muted)]" />
          <div className="mb-1 font-display text-lg font-bold">{t('cartEmpty')}</div>
          <div className="mb-6 text-sm text-[color:var(--muted)]">{t('cartEmptyHint')}</div>
          <button onClick={() => navigate('/discovery')} className="btn-primary max-w-[220px]">
            {t('browseCooks')}
          </button>
        </div>
      ) : (
        <div className="space-y-4 px-5 pt-2">
          <div className="space-y-3">
            {cart.items.map((item) => (
              <CartItem key={item.id} item={item} />
            ))}
          </div>

          <textarea
            className="field-input min-h-[60px] resize-y"
            placeholder={t('notePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />

          {error && (
            <div className="rounded-lg bg-ember/10 px-3 py-2.5 text-[13px] font-medium text-ember-dark">{error}</div>
          )}

          <CartSummary subtotal={cart.subtotal} deliveryFee={0} onCheckout={checkout} busy={busy} />
        </div>
      )}
    </div>
  );
}
