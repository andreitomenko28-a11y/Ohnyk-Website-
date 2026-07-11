import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import BottomNav from '../components/BottomNav.jsx';

// Home screen — Phase 1 uses static demo content for cooks/dishes.
// Real data arrives in Phase 2. The header is wired to the logged-in user.
export default function HomePage() {
  const { user, logout } = useAuth();
  const { t } = useI18n();

  const initial = (user?.fullName || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[420px] bg-linen pb-24">
      <header className="sticky top-0 z-10 bg-linen px-5 pb-4 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-[color:var(--muted)]">
              {t('hi')}, {user?.fullName?.split(' ')[0] || '👋'} 👋
            </div>
            <div className="flex items-center gap-1 font-display text-base font-bold">
              📍 Черкаси, центр
            </div>
          </div>
          <button
            onClick={logout}
            title={t('logout')}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full font-display text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember))' }}
          >
            {initial}
          </button>
        </div>

        <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-[color:var(--line)] bg-white px-4 py-3">
          <span className="text-[15px] opacity-50">🔍</span>
          <input
            className="w-full border-none bg-transparent text-sm text-soot outline-none placeholder:text-[color:rgba(36,30,27,0.4)]"
            placeholder={t('searchPlaceholder')}
          />
        </div>
      </header>

      {/* Category chips */}
      <div className="flex gap-2.5 overflow-x-auto px-5 pb-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((c, i) => (
          <div
            key={c}
            className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-4 py-2.5 text-[13px] font-semibold transition-all ${
              i === 0
                ? 'border-ember bg-ember text-white'
                : 'border-[color:var(--line)] bg-white text-soot'
            }`}
          >
            {c}
          </div>
        ))}
      </div>

      {/* Popular cooks — horizontal scroll */}
      <Section title={t('popularCooks')} link={t('seeAll')}>
        <div className="-mx-5 flex gap-3.5 overflow-x-auto px-5 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FEATURED.map((f) => (
            <div
              key={f.name}
              className="w-[210px] flex-none overflow-hidden rounded-card border border-[color:var(--line)] bg-white shadow-[0_14px_30px_-22px_rgba(36,30,27,0.4)]"
            >
              <div
                className="flex h-[120px] items-center justify-center text-[34px]"
                style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember-dark))' }}
              >
                {f.emoji}
              </div>
              <div className="px-3.5 pb-3.5 pt-3">
                <div className="mb-0.5 text-sm font-bold">{f.name}</div>
                <div className="text-xs text-[color:var(--muted)]">{f.sub}</div>
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-ember-dark">★ {f.rating}</span>
                  <span className="text-[color:var(--muted)]">{f.distance}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Cooking today — vertical list */}
      <Section title={t('cookingToday')}>
        {COOKS.map((c) => (
          <div
            key={c.name}
            className="mb-3 flex items-center gap-3.5 rounded-2xl border border-[color:var(--line)] bg-white p-3"
          >
            <div
              className="flex h-16 w-16 flex-none items-center justify-center rounded-[14px] text-[26px]"
              style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember))' }}
            >
              {c.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{c.name}</div>
              <div className="mt-0.5 text-xs text-[color:var(--muted)]">{c.dish}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {c.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-linen px-2 py-0.5 text-[10px] font-semibold text-[color:var(--muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-none text-right">
              <div className="text-[13px] font-bold">{c.price}</div>
              <div className="mt-1 text-[11px] font-bold text-ember-dark">★ {c.rating}</div>
            </div>
          </div>
        ))}
      </Section>

      <BottomNav />
    </div>
  );
}

function Section({ title, link, children }) {
  return (
    <div className="px-5 pb-1.5 pt-5">
      <div className="mb-3.5 flex items-baseline justify-between">
        <div className="font-display text-[17px] font-bold">{title}</div>
        {link && <a href="#" className="text-xs font-semibold text-ember">{link}</a>}
      </div>
      {children}
    </div>
  );
}

const CATEGORIES = ['🍲 Все', '🥣 Борщ', '🥟 Варенички', '🍢 Шашлики', '🥗 Салати', '🍰 Десерти'];

const FEATURED = [
  { emoji: '🥣', name: 'Кухня Оксани', sub: 'Домашній борщ та вареники', rating: '4.9', distance: '700 м' },
  { emoji: '🍢', name: 'Дядько Гриць', sub: 'Шашлики на замовлення', rating: '4.8', distance: '1.2 км' },
  { emoji: '🍰', name: 'Солодко у Тані', sub: 'Торти та десерти', rating: '5.0', distance: '900 м' },
];

const COOKS = [
  { emoji: '🥘', name: 'Марія Ковальчук', dish: 'Плов, домашній хліб', tags: ['Готово о 18:00', 'Самовивіз'], price: 'від 120₴', rating: '4.7' },
  { emoji: '🥟', name: 'Родина Петренків', dish: 'Вареники з вишнею', tags: ['Готово о 17:30', 'Доставка'], price: 'від 95₴', rating: '4.9' },
  { emoji: '🍞', name: 'Пекарня Люби', dish: 'Пампушки, хліб на заквасці', tags: ['Готово о 9:00', 'Самовивіз'], price: 'від 60₴', rating: '5.0' },
];
