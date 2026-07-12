import { useState } from 'react';
import { useCart } from '../context/CartContext.jsx';

// A single line in the cart with quantity stepper + remove.
export default function CartItem({ item }) {
  const { updateItem, removeItem } = useCart();
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-[color:var(--line)] bg-surface p-3">
      <div
        className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-[12px] text-[22px]"
        style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember))' }}
      >
        {item.dish.image ? (
          <img src={item.dish.image} alt={item.dish.name} className="h-full w-full object-cover" />
        ) : (
          item.dish.category?.emoji || '🍽️'
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{item.dish.name}</div>
        <div className="mt-0.5 text-xs text-[color:var(--muted)]">{item.dish.price}₴</div>
        <div className="mt-1.5 text-[13px] font-bold text-ember-dark">{item.lineTotal}₴</div>
      </div>

      <div className="flex flex-none flex-col items-end gap-2">
        <div className="flex items-center gap-2.5">
          <button
            disabled={busy}
            onClick={() => run(() => updateItem(item.id, item.quantity - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-ember text-base font-bold text-ember-dark disabled:opacity-50"
          >
            −
          </button>
          <span className="w-4 text-center text-sm font-bold">{item.quantity}</span>
          <button
            disabled={busy}
            onClick={() => run(() => updateItem(item.id, item.quantity + 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-ember text-base font-bold text-ember-dark disabled:opacity-50"
          >
            +
          </button>
        </div>
        <button
          disabled={busy}
          onClick={() => run(() => removeItem(item.id))}
          className="text-[11px] font-semibold text-[color:var(--muted)] underline"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
