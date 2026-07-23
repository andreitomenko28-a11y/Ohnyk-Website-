import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';

// Reusable confirmation dialog. Pass `withReason` to collect an optional reason
// (passed to onConfirm). `danger` colours the confirm button red.
export default function ConfirmModal({ title, message, confirmLabel, withReason = false, danger = false, onConfirm, onClose }) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm(reason.trim() || undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-card border border-[color:var(--line)] bg-surface p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-[16px] font-bold">{title}</h2>
        {message && <p className="mt-1.5 text-[13.5px] text-[color:var(--muted)]">{message}</p>}
        {withReason && (
          <input
            className="field-input"
            placeholder={t('adminReasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            autoFocus
          />
        )}
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border-[1.5px] border-[color:var(--line)] py-2.5 text-sm font-semibold"
          >
            {t('cancel')}
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-on-accent disabled:opacity-60 ${
              danger ? 'bg-red-500' : 'bg-gradient-to-br from-[color:var(--ember)] to-[color:var(--ember-dark)]'
            }`}
          >
            {busy ? t('loading') : confirmLabel || t('adminConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
