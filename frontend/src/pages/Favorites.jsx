import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';
import CookCard from '../components/CookCard.jsx';
import { HeartIcon } from '../components/icons.jsx';

export default function Favorites() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cooks, setCooks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reload whenever the set of favourite ids changes (toggles update it).
  const favKey = (user?.favoriteCookIds ?? []).join(',');
  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get('/users/favorites')
      .then(({ data }) => active && setCooks(data.cooks))
      .catch(() => active && setCooks([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [favKey]);

  return (
    <div className="relative">
      <header className="flex items-center gap-3 px-5 pb-3 pt-5">
        <button onClick={() => navigate('/profile')} className="text-2xl leading-none">
          ‹
        </button>
        <div className="font-display text-xl font-bold">{t('favorites')}</div>
      </header>

      <div className="grid grid-cols-1 gap-3 px-5 pt-1 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-16 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>
        ) : cooks.length === 0 ? (
          <div className="col-span-full flex flex-col items-center py-16 text-center">
            <HeartIcon className="mb-3 h-12 w-12 text-[color:var(--muted)]" />
            <div className="mb-5 text-sm text-[color:var(--muted)]">{t('noFavorites')}</div>
            <button onClick={() => navigate('/discovery')} className="btn-primary max-w-[220px]">
              {t('browseCooks')}
            </button>
          </div>
        ) : (
          cooks.map((cook) => <CookCard key={cook.id} cook={cook} />)
        )}
      </div>

    </div>
  );
}
