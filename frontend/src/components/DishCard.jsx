import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { apiError } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';

// A single dish row with an add-to-cart action.
export default function DishCard({ dish, onConflict }) {
  const { t } = useI18n();
  const { cart, add, updateItem } = useCart();
  const [busy, setBusy] = useState(false);

  const line = cart.items.find((i) => i.dishId === dish.id);
  const qty = line?.quantity ?? 0;

  async function change(delta) {
    setBusy(true);
    try {
      if (line) {
        await updateItem(line.id, Math.max(0, qty + delta));
      } else if (delta > 0) {
        await add(dish.id, 1);
      }
    } catch (err) {
      // 409 = dish belongs to another cook; let the page offer to clear the cart.
      if (err?.response?.status === 409) onConflict?.(dish, apiError(err));
      else alert(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-[color:var(--line)] bg-surface p-3">
      <div
        className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-[14px] text-[24px]"
        style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember))' }}
      >
        {dish.image ? (
          <img src={dish.image} alt={dish.name} className="h-full w-full object-cover" />
        ) : (
          dish.category?.emoji || '🍽️'
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{dish.name}</div>
        {dish.description && (
          <div className="mt-0.5 line-clamp-2 text-xs text-[color:var(--muted)]">
            {dish.description}
          </div>
        )}
        <div className="mt-1 text-[13px] font-bold text-ember-dark">{dish.price}₴</div>
      </div>

      <div className="flex-none">
        {!dish.isAvailable ? (
          <span className="text-[11px] font-semibold text-[color:var(--muted)]">
            {t('unavailable')}
          </span>
        ) : qty > 0 ? (
          <Stepper qty={qty} busy={busy} onDec={() => change(-1)} onInc={() => change(1)} />
        ) : (
          <button
            disabled={busy}
            onClick={() => change(1)}
            className="rounded-xl px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, var(--ember), var(--ember-dark))' }}
          >
            + {t('addToCart')}
          </button>
        )}
      </div>
    </div>
  );
}

function Stepper({ qty, busy, onDec, onInc }) {
  return (
    <div className="flex items-center gap-2.5">
      <StepBtn disabled={busy} onClick={onDec}>
        −
      </StepBtn>
      <span className="w-5 text-center text-sm font-bold">{qty}</span>
      <StepBtn disabled={busy} onClick={onInc}>
        +
      </StepBtn>
    </div>
  );
}

function StepBtn({ disabled, onClick, children }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-ember text-lg font-bold text-ember-dark disabled:opacity-50"
    >
      {children}
    </button>
  );
}
