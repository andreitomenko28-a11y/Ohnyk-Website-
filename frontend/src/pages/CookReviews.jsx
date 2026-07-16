import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import CookShell from '../components/CookShell.jsx';
import StarRating from '../components/StarRating.jsx';

export default function CookReviews() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const verified = user?.cook?.verificationStatus === 'VERIFIED';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(verified);

  const load = useCallback(async () => {
    const { data } = await api.get('/cook/reviews');
    setData(data);
  }, []);

  useEffect(() => {
    if (!verified) return;
    let active = true;
    (async () => {
      try {
        await load();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [verified, load]);

  if (!verified) {
    return (
      <CookShell>
        <div className="rounded-card border border-dashed border-[color:var(--line)] px-4 py-12 text-center text-sm text-[color:var(--muted)]">
          {t('reviewsLockedHint')}
        </div>
      </CookShell>
    );
  }

  return (
    <CookShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{t('reviews')}</h1>
        {data?.total > 0 && (
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <StarRating value={data.average} size="h-4 w-4" />
            {data.average.toFixed(1)} <span className="font-normal text-[color:var(--muted)]">({data.total})</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>
      ) : data.total === 0 ? (
        <div className="rounded-card border border-dashed border-[color:var(--line)] px-4 py-12 text-center text-[13px] text-[color:var(--muted)]">
          {t('noReviews')}
        </div>
      ) : (
        <div className="space-y-3">
          {data.reviews.map((r) => (
            <ReviewRow key={r.id} review={r} lang={lang} t={t} onChange={load} />
          ))}
        </div>
      )}
    </CookShell>
  );
}

function ReviewRow({ review, lang, t, onChange }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.reply || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/cook/reviews/${review.id}/reply`, { reply: text.trim() });
      setEditing(false);
      await onChange();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api.delete(`/cook/reviews/${review.id}/reply`);
      setText('');
      setEditing(false);
      await onChange();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[14px] font-semibold">{review.author?.name}</span>
        <span className="text-[12px] text-[color:var(--muted)]">
          {new Date(review.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </span>
      </div>
      <StarRating value={review.rating} size="h-3.5 w-3.5" />
      {review.comment && <p className="mt-1.5 text-[13.5px] leading-relaxed">{review.comment}</p>}

      {/* Reply */}
      {review.reply && !editing ? (
        <div className="mt-2 rounded-lg bg-elevated px-3 py-2 text-[12.5px] leading-relaxed">
          <span className="font-semibold text-ember">{t('cookReply')}:</span> {review.reply}
          <div className="mt-2 flex gap-2">
            <button onClick={() => setEditing(true)} className="text-[12px] font-semibold text-[color:var(--muted)] hover:text-fg">
              {t('editReply')}
            </button>
            <button onClick={remove} disabled={busy} className="text-[12px] font-semibold text-red-500 disabled:opacity-60">
              {t('deleteReply')}
            </button>
          </div>
        </div>
      ) : editing || !review.reply ? (
        <div className="mt-2">
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-[13px] font-semibold text-ember">
              {t('replyToReview')}
            </button>
          )}
          {editing && (
            <>
              <textarea
                className="field-input min-h-[56px] resize-y"
                placeholder={t('replyPlaceholder')}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
              />
              {error && <div className="mt-1 text-[12px] text-red-500">{error}</div>}
              <div className="mt-2 flex gap-2">
                <button onClick={save} disabled={busy} className="btn-primary max-w-[160px]">
                  {busy ? t('loading') : t('sendReply')}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setText(review.reply || '');
                    setError('');
                  }}
                  className="rounded-lg border border-[color:var(--line)] px-4 py-2 text-[14px] font-semibold text-[color:var(--muted)]"
                >
                  {t('cancel')}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
