import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { HeartIcon } from './icons.jsx';

// Heart toggle that adds/removes a cook from the user's favourites.
export default function FavoriteButton({ cookId, className = '', size = 'md' }) {
  const { t } = useI18n();
  const { user, toggleFavorite } = useAuth();
  const [busy, setBusy] = useState(false);

  const isFav = user?.favoriteCookIds?.includes(cookId) ?? false;
  const dims = size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const iconSize = size === 'lg' ? 'h-5 w-5' : size === 'sm' ? 'h-[15px] w-[15px]' : 'h-[17px] w-[17px]';

  async function onClick(e) {
    // Stop the click from triggering a parent card's navigation.
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await toggleFavorite(cookId);
    } catch {
      /* keep the previous state on failure */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={isFav}
      aria-label={isFav ? t('removeFavorite') : t('addFavorite')}
      title={isFav ? t('removeFavorite') : t('addFavorite')}
      className={`flex flex-none items-center justify-center rounded-full border border-line bg-surface/85 shadow-sm backdrop-blur-sm transition-transform active:scale-90 disabled:opacity-60 ${
        isFav ? 'text-ember' : 'text-[color:var(--muted)]'
      } ${dims} ${className}`}
    >
      <HeartIcon className={iconSize} filled={isFav} />
    </button>
  );
}
