import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useCart } from '../context/CartContext.jsx';
import BottomNav from '../components/BottomNav.jsx';
import CartItem from '../components/CartItem.jsx';
import CartSummary from '../components/CartSummary.jsx';

export default function Cart() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { cart, loading, clear } = useCart();

  const empty = cart.items.length === 0;

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[420px] bg-linen pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-linen px-5 pb-3 pt-5">
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
          <div className="mb-4 text-5xl">🛒</div>
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
          <CartSummary
            subtotal={cart.subtotal}
            deliveryFee={0}
            onCheckout={() => alert(t('checkoutSoon'))}
          />
        </div>
      )}

      <BottomNav />
    </div>
  );
}
