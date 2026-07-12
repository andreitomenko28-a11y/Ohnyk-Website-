import { useI18n } from '../i18n/index.jsx';

// Search input + horizontally scrollable category chips.
export default function SearchBar({
  value,
  onChange,
  categories = [],
  activeCategory = null,
  onCategory,
  onSubmit,
}) {
  const { t } = useI18n();

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.(value);
        }}
        className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-[color:var(--line)] bg-white px-4 py-3"
      >
        <span className="text-[15px] opacity-50">🔍</span>
        <input
          className="w-full border-none bg-transparent text-sm text-soot outline-none placeholder:text-[color:rgba(36,30,27,0.4)]"
          placeholder={t('searchPlaceholder')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </form>

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
          : 'border-[color:var(--line)] bg-white text-soot'
      }`}
    >
      {children}
    </button>
  );
}
