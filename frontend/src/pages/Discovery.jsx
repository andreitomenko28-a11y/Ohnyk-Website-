import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n/index.jsx';
import api from '../api/client.js';
import SearchBar from '../components/SearchBar.jsx';
import FilterPanel from '../components/FilterPanel.jsx';
import CookCard from '../components/CookCard.jsx';

// Discovery — browse, search and filter cooks.
export default function Discovery() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [filters, setFilters] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [cooks, setCooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data.categories)).catch(() => {});
  }, []);

  // Pick the right endpoint based on active query/category/filters.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (query.trim()) {
        res = await api.get('/cooks/search', { params: { q: query.trim() } });
      } else if (category || filters.minPrice || filters.maxPrice || filters.minRating) {
        res = await api.get('/cooks/filter', {
          params: {
            ...(category && { category }),
            ...(filters.minPrice && { minPrice: filters.minPrice }),
            ...(filters.maxPrice && { maxPrice: filters.maxPrice }),
            ...(filters.minRating && { minRating: filters.minRating }),
          },
        });
      } else {
        res = await api.get('/cooks', { params: { limit: 20 } });
      }
      setCooks(res.data.cooks);
    } catch {
      setCooks([]);
    } finally {
      setLoading(false);
    }
  }, [query, category, filters]);

  // Debounce search-driven reloads.
  useEffect(() => {
    const id = setTimeout(load, query ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, query]);

  return (
    <div className="relative">
      <header className="sticky top-0 z-10 bg-canvas px-5 pb-3 pt-5">
        <div className="mb-4 font-display text-xl font-bold">{t('discoveryTitle')}</div>
        <SearchBar
          value={query}
          onChange={setQuery}
          categories={categories}
          activeCategory={category}
          onCategory={(c) => {
            setCategory(c);
            setQuery('');
          }}
          onFilter={() => setFiltersOpen((o) => !o)}
        />
        <FilterPanel
          value={filters}
          open={filtersOpen}
          onToggle={() => setFiltersOpen((o) => !o)}
          onApply={(f) => setFilters(f)}
          onReset={() => setFilters({})}
        />
      </header>

      <div className="grid grid-cols-1 gap-3 px-5 pt-3 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-16 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>
        ) : cooks.length === 0 ? (
          <div className="col-span-full py-16 text-center text-sm text-[color:var(--muted)]">{t('noResults')}</div>
        ) : (
          cooks.map((cook) => <CookCard key={cook.id} cook={cook} />)
        )}
      </div>

    </div>
  );
}
