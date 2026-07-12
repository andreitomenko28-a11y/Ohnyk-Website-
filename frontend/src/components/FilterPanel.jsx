import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { SlidersIcon, Star } from './icons.jsx';

// Filter panel: price range + minimum rating.
// `open`/`onToggle` are optional — when omitted the panel manages its own state.
export default function FilterPanel({ value, onApply, onReset, open, onToggle, showToggle = true }) {
  const { t } = useI18n();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const toggle = onToggle ?? (() => setInternalOpen((o) => !o));
  const [draft, setDraft] = useState(value);

  const activeCount =
    (value.minPrice ? 1 : 0) + (value.maxPrice ? 1 : 0) + (value.minRating ? 1 : 0);

  return (
    <div className="mt-3">
      {showToggle && (
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 rounded-full border-[1.5px] border-line bg-surface px-4 py-2 text-[13px] font-semibold text-fg"
        >
          <SlidersIcon className="h-4 w-4" /> {t('filters')}
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-ember px-1.5 text-[11px] font-bold text-on-accent">
              {activeCount}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-1.5 text-[13px] font-semibold">{t('priceRange')}</div>
          <div className="mb-4 flex items-center gap-2">
            <input
              type="number"
              min="0"
              placeholder="0"
              value={draft.minPrice ?? ''}
              onChange={(e) => setDraft({ ...draft, minPrice: e.target.value || undefined })}
              className="field-input"
            />
            <span className="text-[color:var(--muted)]">—</span>
            <input
              type="number"
              min="0"
              placeholder="∞"
              value={draft.maxPrice ?? ''}
              onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value || undefined })}
              className="field-input"
            />
          </div>

          <div className="mb-1.5 text-[13px] font-semibold">{t('minRating')}</div>
          <div className="mb-4 flex gap-2">
            {[0, 4, 4.5, 4.8].map((r) => (
              <button
                key={r}
                onClick={() => setDraft({ ...draft, minRating: r || undefined })}
                className={`flex flex-1 items-center justify-center gap-1 rounded-xl border-[1.5px] py-2 text-[13px] font-semibold transition-all ${
                  (draft.minRating ?? 0) === r
                    ? 'border-ember bg-ember/[0.1] text-ember-dark'
                    : 'border-line'
                }`}
              >
                {r ? (
                  <>
                    <Star className="h-3.5 w-3.5 text-star" /> {r}+
                  </>
                ) : (
                  t('allCategories')
                )}
              </button>
            ))}
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() => {
                const cleared = { minPrice: undefined, maxPrice: undefined, minRating: undefined };
                setDraft(cleared);
                onReset?.();
              }}
              className="flex-1 rounded-xl border-[1.5px] border-line py-2.5 text-sm font-semibold"
            >
              {t('reset')}
            </button>
            <button
              onClick={() => {
                onApply?.(draft);
                toggle();
              }}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-on-accent"
              style={{ background: 'linear-gradient(135deg, var(--ember), var(--ember-dark))' }}
            >
              {t('apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
