import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import api from '../api/client.js';
import Menu from '../components/Menu.jsx';
import BottomNav from '../components/BottomNav.jsx';
import FavoriteButton from '../components/FavoriteButton.jsx';
import { VerifiedBadge, Star } from '../components/icons.jsx';
import { useCart } from '../context/CartContext.jsx';

// Cook detail: header card + grouped menu.
export default function CookProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { clear, add } = useCart();
  const [cook, setCook] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conflict, setConflict] = useState(null); // { dish, message }

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.get(`/cooks/${id}`), api.get(`/cooks/${id}/menu`)])
      .then(([c, m]) => {
        if (!active) return;
        setCook(c.data.cook);
        setMenu(m.data.menu);
      })
      .catch(() => active && setCook(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  // Replace cart contents with the conflicting dish's cook.
  async function switchCook() {
    const dish = conflict.dish;
    await clear();
    await add(dish.id, 1);
    setConflict(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[color:var(--muted)]">
        {t('loading')}
      </div>
    );
  }

  if (!cook) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center gap-4">
        <div className="text-[color:var(--muted)]">{t('noResults')}</div>
        <button onClick={() => navigate('/discovery')} className="text-ember font-semibold">
          {t('back')}
        </button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[420px] bg-canvas pb-24">
      {/* Hero */}
      <div
        className="relative flex h-40 items-end p-5"
        style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember-dark))' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-lg"
        >
          ‹
        </button>
        <FavoriteButton cookId={cook.id} size="lg" className="absolute right-4 top-4" />
        <div className="text-4xl">{cook.avatar ? '' : '🍲'}</div>
      </div>

      <div className="px-5">
        <div className="-mt-8 rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2 font-display text-xl font-bold">
            {cook.name}
            {cook.isVerified && <VerifiedBadge className="h-5 w-5 flex-none" title={t('verified')} />}
          </div>
          {cook.bio && <div className="mt-1 text-sm text-[color:var(--muted)]">{cook.bio}</div>}
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1 rounded-full bg-elevated px-2.5 py-1">
              <Star className="h-3.5 w-3.5 text-star" /> {cook.rating.toFixed(1)} ({cook.reviewCount})
            </span>
            <span className="rounded-full bg-elevated px-2.5 py-1 text-[color:var(--muted)]">
              📍 {cook.city}
            </span>
            <span className="rounded-full bg-elevated px-2.5 py-1 text-[color:var(--muted)]">
              {cook.dishCount} {t('dishesCount')}
            </span>
          </div>
        </div>

        <div className="mb-4 mt-6 font-display text-[17px] font-bold">{t('menu')}</div>
        {menu.length === 0 ? (
          <div className="py-10 text-center text-sm text-[color:var(--muted)]">{t('noResults')}</div>
        ) : (
          <Menu menu={menu} onConflict={(dish, message) => setConflict({ dish, message })} />
        )}
      </div>

      {/* Cross-cook conflict sheet */}
      {conflict && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40" onClick={() => setConflict(null)}>
          <div
            className="w-full max-w-[420px] rounded-t-card bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-sm">{conflict.message}</div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConflict(null)}
                className="flex-1 rounded-xl border-[1.5px] border-[color:var(--line)] py-3 text-sm font-semibold"
              >
                {t('cancel')}
              </button>
              <button onClick={switchCook} className="flex-1 btn-primary">
                {t('clearCart')} + {t('addToCart')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
