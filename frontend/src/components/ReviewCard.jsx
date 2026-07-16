import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import StarRating from './StarRating.jsx';

// Buyer's review of a delivered order: shows the existing review (edit/delete)
// or a form to leave one.
export default function ReviewCard({ orderId, review, cookName, onChange }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(!review);
  const [rating, setRating] = useState(review?.rating || 0);
  const [comment, setComment] = useState(review?.comment || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!rating) {
      setError(t('pickRating'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post(`/orders/${orderId}/review`, { rating, comment: comment.trim() });
      setEditing(false);
      await onChange?.();
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
      await api.delete(`/orders/${orderId}/review`);
      setRating(0);
      setComment('');
      setEditing(true);
      await onChange?.();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
      <h2 className="mb-2 font-display text-[15px] font-bold">{t('yourReview')}</h2>

      {!editing && review ? (
        <>
          <StarRating value={review.rating} size="h-5 w-5" />
          {review.comment && <p className="mt-1.5 text-[13.5px] leading-relaxed">{review.comment}</p>}
          {review.reply && (
            <div className="mt-2 rounded-lg bg-elevated px-3 py-2 text-[12.5px] leading-relaxed">
              <span className="font-semibold text-ember">{t('cookReply')}:</span> {review.reply}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={() => setEditing(true)} className="rounded-lg border border-[color:var(--line)] px-3 py-1.5 text-[13px] font-semibold">
              {t('editReview')}
            </button>
            <button onClick={remove} disabled={busy} className="rounded-lg border border-[color:var(--line)] px-3 py-1.5 text-[13px] font-semibold text-red-500 disabled:opacity-60">
              {t('deleteReview')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-2 text-[13px] text-[color:var(--muted)]">
            {t('rateCook')} {cookName}
          </div>
          <StarRating value={rating} onChange={setRating} size="h-8 w-8" />
          <textarea
            className="field-input mt-3 min-h-[64px] resize-y"
            placeholder={t('reviewPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
          />
          {error && <div className="mt-2 rounded-lg bg-ember/10 px-3 py-2 text-[13px] font-medium text-ember-dark">{error}</div>}
          <div className="mt-3 flex gap-2">
            <button onClick={submit} disabled={busy} className="btn-primary max-w-[200px]">
              {busy ? t('loading') : t('submitReview')}
            </button>
            {review && (
              <button
                onClick={() => {
                  setEditing(false);
                  setRating(review.rating);
                  setComment(review.comment || '');
                  setError('');
                }}
                className="rounded-lg border border-[color:var(--line)] px-4 py-2 text-[14px] font-semibold text-[color:var(--muted)]"
              >
                {t('cancel')}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
