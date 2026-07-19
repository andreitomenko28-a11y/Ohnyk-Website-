import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import api from '../api/client.js';
import CookCard from '../components/CookCard.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import BrandMark from '../components/BrandMark.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import CitySelect from '../components/CitySelect.jsx';
import { MVP_CITY } from '../lib/cities.js';
import { Star, SearchIcon, MapPinIcon, ChevronDownIcon } from '../components/icons.jsx';

const CITY_KEY = 'ohnyk_city';

function initialOf(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

// Home screen — now backed by real cooks/categories (Phase 2).
export default function HomePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [cooks, setCooks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Buyer's chosen delivery city (persisted). Defaults to the MVP city.
  const [city, setCity] = useState(() => localStorage.getItem(CITY_KEY) || user?.cook?.city || MVP_CITY);

  function pickCity(v) {
    if (!v) return;
    setCity(v);
    localStorage.setItem(CITY_KEY, v);
    navigate(`/discovery?city=${encodeURIComponent(v)}`);
  }

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
    <div className="relative">
      <header className="sticky top-0 z-10 bg-canvas px-5 pb-4 pt-5">
        {/* Top navbar with brand (mobile — desktop has the sidebar brand) */}
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <BrandMark className="text-[22px]" markClassName="h-7 w-7" />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={() => navigate('/profile')}
              title={t('profileTitle')}
              className="flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-full font-display text-sm font-bold text-on-accent"
              style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember))' }}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-xs text-[color:var(--muted)]">
              {t('hi')}, {user?.fullName?.split(' ')[0] || t('friend')}
            </div>
            <div className="relative inline-flex items-center gap-1 font-display text-lg font-bold">
              <MapPinIcon className="h-4 w-4 text-ember" /> {city}
              <ChevronDownIcon className="h-4 w-4 text-[color:var(--muted)]" />
              {/* Transparent native select over the badge — tapping opens the city list. */}
              <CitySelect
                value={city}
                onChange={pickCity}
                aria-label={t('cityLabel')}
                className="absolute inset-0 !mt-0 cursor-pointer opacity-0"
              />
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/discovery')}
          className="flex w-full items-center gap-2.5 rounded-2xl border-[1.5px] border-line bg-surface px-4 py-3 text-left"
        >
          <SearchIcon className="h-[18px] w-[18px] text-[color:var(--muted)]" />
          <span className="text-sm text-[color:var(--muted)]">{t('searchPlaceholder')}</span>
        </button>
      </header>

      {/* Category chips → Discovery */}
      <div className="flex gap-2.5 overflow-x-auto px-5 pb-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip onClick={() => navigate('/discovery')}>{t('allCategories')}</Chip>
        {categories.map((c) => (
          <Chip key={c.slug} onClick={() => navigate('/discovery')}>
            {c.name}
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
              {featured.map((f) => (
                <button
                  key={f.id}
                  onClick={() => navigate(`/cooks/${f.id}`)}
                  className="w-[210px] flex-none overflow-hidden rounded-card border border-line bg-surface text-left shadow-card"
                >
                  <div
                    className="flex h-[120px] items-center justify-center font-display text-4xl font-bold text-on-accent"
                    style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember-dark))' }}
                  >
                    {initialOf(f.name)}
                  </div>
                  <div className="px-3.5 pb-3.5 pt-3">
                    <div className="mb-0.5 truncate text-sm font-bold">{f.name}</div>
                    <div className="truncate text-xs text-[color:var(--muted)]">{f.bio}</div>
                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 font-bold">
                        <Star className="h-3.5 w-3.5 text-star" /> {f.rating.toFixed(1)}
                      </span>
                      <span className="text-[color:var(--muted)]">
                        {f.priceFrom != null ? `${t('from')} ${f.priceFrom}₴` : ''}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* Cooking today — vertical list (grid on desktop) */}
          <Section title={t('cookingToday')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rest.map((c) => (
                <CookCard key={c.id} cook={c} />
              ))}
            </div>
          </Section>
        </>
      )}

    </div>
  );
}

function Chip({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-[color:var(--line)] bg-surface px-4 py-2.5 text-[13px] font-semibold text-fg"
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
