import { useI18n } from '../i18n/index.jsx';

// A saved address with default toggle + delete.
export default function AddressCard({ address, onMakeDefault, onDelete, busy }) {
  const { t } = useI18n();
  const line2 = [
    address.building && `${t('building')} ${address.building}`,
    address.apartment && `${t('apartment')} ${address.apartment}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold">
            📍 {address.street}
            {address.isDefault && (
              <span className="rounded-full bg-ember/10 px-2 py-0.5 text-[10px] font-semibold text-ember-dark">
                {t('defaultBadge')}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            {address.city}
            {line2 ? `, ${line2}` : ''}
            {address.postalCode ? `, ${address.postalCode}` : ''}
          </div>
        </div>
        <button
          disabled={busy}
          onClick={() => onDelete(address.id)}
          className="flex-none text-[color:var(--muted)] disabled:opacity-50"
          title={t('remove')}
        >
          🗑️
        </button>
      </div>

      {!address.isDefault && (
        <button
          disabled={busy}
          onClick={() => onMakeDefault(address.id)}
          className="mt-3 text-[13px] font-semibold text-ember disabled:opacity-50"
        >
          {t('makeDefault')}
        </button>
      )}
    </div>
  );
}
