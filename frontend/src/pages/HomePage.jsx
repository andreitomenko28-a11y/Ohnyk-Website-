import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import api from '../api/client.js';
import BottomNav from '../components/BottomNav.jsx';
import CookCard from '../components/CookCard.jsx';

const EMOJI = ['🥣', '🍢', '🍰', '🍞', '🥘', '🥟'];

// Home screen — now backed by real cooks/categories (Phase 2).
export default function HomePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [cooks, setCooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/categories'), api.get('/cooks', { params: { limit: 10 } })])
      .then(([c, k]) => {
        if (!active) return;
        setCategories(c.data.categories);
        setCooks(k.data.cooks);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const initial = (user?.fullName || '?').trim().charAt(0).toUpperCase();
  const featured = cooks.slice(0, 5);
  const rest = cooks.slice(0, 6);

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[420px] bg-linen pb-24">
      <header className="sticky top-0 z-10 bg-linen px-5 pb-4 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-[color:var(--muted)]">
              {t('hi')}, {user?.fullName?.split(' ')[0] || '👋'} 👋
            </div>
            <div className="flex items-center gap-1 font-display text-base font-bold">
              📍 {user?.cook?.city || 'Черкаси'}
            </div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            title={t('profileTitle')}
            className="flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-full font-display text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember))' }}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </button>
        </div>

        <button
          onClick={() => navigate('/discovery')}
          className="flex w-full items-center gap-2.5 rounded-2xl border-[1.5px] border-[color:var(--line)] bg-white px-4 py-3 text-left"
        >
          <span className="text-[15px] opacity-50">🔍</span>
          <span className="text-sm text-[color:rgba(36,30,27,0.4)]">{t('searchPlaceholder')}</span>
        </button>
      </header>

      {/* Category chips → Discovery */}
      <div className="flex gap-2.5 overflow-x-auto px-5 pb-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip onClick={() => navigate('/discovery')}>🍲 {t('allCategories')}</Chip>
        {categories.map((c) => (
          <Chip key={c.slug} onClick={() => navigate('/discovery')}>
            {c.emoji} {c.name}
          </Chip>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>
      ) : (
        <>
          {/* Popular cooks — horizontal scroll */}
          <Section title={t('popularCooks')} link={t('seeAll')} onLink={() => navigate('/discovery')}>
            <div className="-mx-5 flex gap-3.5 overflow-x-auto px-5 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {featured.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => navigate(`/cooks/${f.id}`)}
                  className="w-[210px] flex-none overflow-hidden rounded-card border border-[color:var(--line)] bg-white text-left shadow-[0_14px_30px_-22px_rgba(36,30,27,0.4)]"
                >
                  <div
                    className="flex h-[120px] items-center justify-center text-[34px]"
                    style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember-dark))' }}
                  >
                    {EMOJI[i % EMOJI.length]}
                  </div>
                  <div className="px-3.5 pb-3.5 pt-3">
                    <div className="mb-0.5 truncate text-sm font-bold">{f.name}</div>
                    <div className="truncate text-xs text-[color:var(--muted)]">{f.bio}</div>
                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="font-bold text-ember-dark">★ {f.rating.toFixed(1)}</span>
                      <span className="text-[color:var(--muted)]">
                        {f.priceFrom != null ? `${t('from')} ${f.priceFrom}₴` : ''}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* Cooking today — vertical list */}
          <Section title={t('cookingToday')}>
            <div className="space-y-3">
              {rest.map((c, i) => (
                <CookCard key={c.id} cook={c} emoji={EMOJI[i % EMOJI.length]} />
              ))}
            </div>
          </Section>
        </>
      )}

      <BottomNav />
    </div>
  );
}

function Chip({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-[color:var(--line)] bg-white px-4 py-2.5 text-[13px] font-semibold text-soot"
    >
      {children}
    </button>
  );
}

function Section({ title, link, onLink, children }) {
  return (
    <div className="px-5 pb-1.5 pt-5">
      <div className="mb-3.5 flex items-baseline justify-between">
        <div className="font-display text-[17px] font-bold">{title}</div>
        {link && (
          <button onClick={onLink} className="text-xs font-semibold text-ember">
            {link}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
