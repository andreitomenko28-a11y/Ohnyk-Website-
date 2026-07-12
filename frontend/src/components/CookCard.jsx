import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import FavoriteButton from './FavoriteButton.jsx';
import { VerifiedBadge, Star, MapPinIcon } from './icons.jsx';

function initialOf(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

// A cook summary card used in Discovery and Home lists.
// Navigation is a full-card overlay button sitting *under* pointer-events-none
// content, so the favourite heart (a separate sibling on top) never triggers it.
export default function CookCard({ cook }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="relative rounded-2xl border border-line bg-surface transition-transform active:scale-[0.99]">
      {/* Clickable overlay (behind content) */}
      <button
        type="button"
        aria-label={cook.name}
        onClick={() => navigate(`/cooks/${cook.id}`)}
        className="absolute inset-0 z-0 h-full w-full rounded-2xl"
      />

      {/* Favourite heart — on top, own click target */}
      <FavoriteButton cookId={cook.id} className="absolute left-2 top-2 z-20" size="sm" />

      {/* Content — transparent to clicks so they reach the overlay */}
      <div className="pointer-events-none relative z-10 flex items-center gap-3.5 p-3">
        <div
          className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-[14px] font-display text-2xl font-bold text-on-accent"
          style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember))' }}
        >
          {cook.avatar ? (
            <img src={cook.avatar} alt={cook.name} className="h-full w-full object-cover" />
          ) : (
            initialOf(cook.name)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm font-bold">
            <span className="truncate">{cook.name}</span>
            {cook.isVerified && <VerifiedBadge className="h-[15px] w-[15px] flex-none" title={t('verified')} />}
          </div>
          {cook.bio && (
            <div className="mt-0.5 truncate text-xs text-[color:var(--muted)]">{cook.bio}</div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-[color:var(--muted)]">
            <span className="flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5">
              <MapPinIcon className="h-3 w-3" /> {cook.city}
            </span>
            <span className="rounded-full bg-elevated px-2 py-0.5">
              {cook.dishCount} {t('dishesCount')}
            </span>
          </div>
        </div>

        <div className="flex-none text-right">
          {cook.priceFrom != null && (
            <div className="text-[13px] font-bold">
              {t('from')} {cook.priceFrom}₴
            </div>
          )}
          <div className="mt-1 flex items-center justify-end gap-1 text-[12px] font-bold">
            <Star className="h-3.5 w-3.5 text-star" />
            {cook.rating.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}
