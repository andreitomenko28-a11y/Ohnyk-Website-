import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import api from '../api/client.js';
import StarRating from './StarRating.jsx';

// Public reviews section for a cook profile: average + list.
export default function CookReviews({ cookId }) {
  const { t, lang } = useI18n();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .get(`/cooks/${cookId}/reviews`)
      .then(({ data }) => active && setData(data))
      .catch(() => active && setData({ reviews: [], total: 0, average: 0 }));
    return () => {
      active = false;
    };
  }, [cookId]);

  if (!data) return null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-display text-[17px] font-bold">
          {t('reviews')} <span className="text-[color:var(--muted)]">({data.total})</span>
        </div>
        {data.total > 0 && (
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <StarRating value={data.average} size="h-4 w-4" />
            {data.average.toFixed(1)}
          </div>
        )}
      </div>

      {data.total === 0 ? (
        <div className="rounded-card border border-dashed border-[color:var(--line)] px-4 py-8 text-center text-[13px] text-[color:var(--muted)]">
          {t('noReviews')}
        </div>
      ) : (
        <div className="space-y-3">
          {data.reviews.map((r) => (
            <div key={r.id} className="rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[14px] font-semibold">{r.author?.name}</span>
                <span className="text-[12px] text-[color:var(--muted)]">
                  {new Date(r.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
              <StarRating value={r.rating} size="h-3.5 w-3.5" />
              {r.comment && <p className="mt-1.5 text-[13.5px] leading-relaxed">{r.comment}</p>}
              {r.photos?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.photos.map((url) => (
                    <img key={url} src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  ))}
                </div>
              )}
              {r.reply && (
                <div className="mt-2 rounded-lg bg-elevated px-3 py-2 text-[12.5px] leading-relaxed">
                  <span className="font-semibold text-ember">{t('cookReply')}:</span> {r.reply}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
