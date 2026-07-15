import { useI18n } from '../i18n/index.jsx';

// Totals block with checkout CTA. Delivery is a flat placeholder until Phase 5.
export default function CartSummary({ subtotal, deliveryFee = 0, onCheckout, busy = false, checkoutLabel }) {
  const { t } = useI18n();
  const total = Number((subtotal + deliveryFee).toFixed(2));

  return (
    <div className="rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
      <Row label={t('subtotal')} value={`${subtotal}₴`} />
      <Row label={t('delivery')} value={deliveryFee ? `${deliveryFee}₴` : '—'} />
      <div className="my-3 border-t border-[color:var(--line)]" />
      <Row label={t('total')} value={`${total}₴`} strong />

      <button onClick={onCheckout} className="btn-primary mt-4" disabled={busy}>
        {busy ? t('loading') : checkoutLabel || t('checkout')}
      </button>
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div
      className={`flex items-center justify-between py-1 ${
        strong ? 'text-base font-bold' : 'text-sm text-[color:var(--muted)]'
      }`}
    >
      <span>{label}</span>
      <span className={strong ? 'text-fg' : 'font-semibold text-fg'}>{value}</span>
    </div>
  );
}
