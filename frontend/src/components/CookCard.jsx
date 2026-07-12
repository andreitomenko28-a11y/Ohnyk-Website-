import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import FavoriteButton from './FavoriteButton.jsx';

// A cook summary card used in Discovery and Home lists.
// Navigation is a full-card overlay button sitting *under* pointer-events-none
// content, so the favourite heart (a separate sibling on top) never triggers it.
export default function CookCard({ cook, emoji = '🍲' }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="relative rounded-2xl border border-[color:var(--line)] bg-white transition-transform active:scale-[0.99]">
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
          className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-[14px] text-[26px]"
          style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember))' }}
        >
          {cook.avatar ? (
            <img src={cook.avatar} alt={cook.name} className="h-full w-full object-cover" />
          ) : (
            emoji
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm font-bold">
            <span className="truncate">{cook.name}</span>
            {cook.isVerified && <span title={t('verified')}>✅</span>}
          </div>
          {cook.bio && (
            <div className="mt-0.5 truncate text-xs text-[color:var(--muted)]">{cook.bio}</div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-semibold text-[color:var(--muted)]">
            <span className="rounded-full bg-linen px-2 py-0.5">📍 {cook.city}</span>
            <span className="rounded-full bg-linen px-2 py-0.5">
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
          <div className="mt-1 text-[11px] font-bold text-ember-dark">
            ★ {cook.rating.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}
