import { useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import StarRating from './StarRating.jsx';

const MAX_PHOTOS = 5;

// Buyer's review of a delivered order: shows the existing review (edit/delete)
// or a form to leave one — now with photo attachments (Module 6.2).
export default function ReviewCard({ orderId, review, cookName, onChange }) {
  const { t } = useI18n();
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(!review);
  const [rating, setRating] = useState(review?.rating || 0);
  const [comment, setComment] = useState(review?.comment || '');
  const [keptPhotos, setKeptPhotos] = useState(review?.photos || []); // existing URLs
  const [staged, setStaged] = useState([]); // new File objects
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const totalPhotos = keptPhotos.length + staged.length;

  function resetForm() {
    setRating(review?.rating || 0);
    setComment(review?.comment || '');
    setKeptPhotos(review?.photos || []);
    setStaged([]);
    setError('');
  }

  async function submit() {
    if (!rating) {
      setError(t('pickRating'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('rating', String(rating));
      fd.append('comment', comment.trim());
      fd.append('keepPhotos', JSON.stringify(keptPhotos));
      staged.forEach((f) => fd.append('photos', f));
      await api.post(`/orders/${orderId}/review`, fd);
      setStaged([]);
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
      setKeptPhotos([]);
      setStaged([]);
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
          {review.photos?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {review.photos.map((url) => (
                <img key={url} src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ))}
            </div>
          )}
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

          {/* Photos */}
          <label className="field-label">{t('photos')}</label>
          <div className="flex flex-wrap gap-2">
            {keptPhotos.map((url) => (
              <div key={url} className="relative">
                <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setKeptPhotos((p) => p.filter((u) => u !== url))}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-[11px] text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            {staged.map((f, i) => (
              <div key={i} className="relative">
                <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded-lg object-cover opacity-70" />
                <button
                  type="button"
                  onClick={() => setStaged((s) => s.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-[11px] text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            {totalPhotos < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-[color:var(--line)] text-[color:var(--muted)] hover:border-ember hover:text-ember"
              >
                +
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                setStaged((s) => [...s, ...picked].slice(0, MAX_PHOTOS - keptPhotos.length));
                if (fileRef.current) fileRef.current.value = '';
              }}
            />
          </div>

          {error && <div className="mt-2 rounded-lg bg-ember/10 px-3 py-2 text-[13px] font-medium text-ember-dark">{error}</div>}
          <div className="mt-3 flex gap-2">
            <button onClick={submit} disabled={busy} className="btn-primary max-w-[200px]">
              {busy ? t('loading') : t('submitReview')}
            </button>
            {review && (
              <button
                onClick={() => {
                  setEditing(false);
                  resetForm();
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
