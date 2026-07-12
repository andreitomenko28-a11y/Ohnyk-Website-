import { useI18n } from '../i18n/index.jsx';
import { SearchIcon, SlidersIcon } from './icons.jsx';

// Search input (with an optional ember filter button) + category chips.
export default function SearchBar({
  value,
  onChange,
  categories = [],
  activeCategory = null,
  onCategory,
  onSubmit,
  onFilter,
}) {
  const { t } = useI18n();

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.(value);
          }}
          className="flex flex-1 items-center gap-2.5 rounded-2xl border-[1.5px] border-line bg-surface px-4 py-3"
        >
          <SearchIcon className="h-[18px] w-[18px] flex-none text-[color:var(--muted)]" />
          <input
            className="w-full border-none bg-transparent text-sm text-fg outline-none placeholder:text-[color:var(--muted)]"
            placeholder={t('searchPlaceholder')}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </form>
        {onFilter && (
          <button
            type="button"
            onClick={onFilter}
            aria-label={t('filters')}
            className="flex h-[50px] w-[50px] flex-none items-center justify-center rounded-2xl text-on-accent"
            style={{ background: 'linear-gradient(135deg, var(--ember), var(--ember-dark))' }}
          >
            <SlidersIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip active={!activeCategory} onClick={() => onCategory?.(null)}>
            🍲 {t('allCategories')}
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.slug}
              active={activeCategory === c.slug}
              onClick={() => onCategory?.(c.slug)}
            >
              {c.emoji} {c.name}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-4 py-2.5 text-[13px] font-semibold transition-all ${
        active
          ? 'border-ember bg-ember text-white'
          : 'border-[color:var(--line)] bg-surface text-fg'
      }`}
    >
      {children}
    </button>
  );
}
