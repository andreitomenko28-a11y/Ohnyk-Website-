import { useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { fileToCompressedDataUrl } from '../lib/image.js';
import CitySelect from './CitySelect.jsx';
import { MVP_CITY } from '../lib/cities.js';

// Inline profile editor. Cooks additionally get bio + city fields.
export default function ProfileForm({ onDone }) {
  const { t } = useI18n();
  const { user, setUser } = useAuth();
  const isCook = user.role === 'COOK';

  const [form, setForm] = useState({
    fullName: user.fullName || '',
    phone: user.phone || '',
    avatar: user.avatar || '',
    bio: user.cook?.bio || '',
    city: user.cook?.city || MVP_CITY,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function onPickPhoto(e) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = ''; // allow re-picking the same file
    if (!file) return;
    setError('');
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setForm((f) => ({ ...f, avatar: dataUrl }));
    } catch {
      setError(t('photoTooLarge'));
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        fullName: form.fullName,
        phone: form.phone,
        avatar: form.avatar,
        ...(isCook && { bio: form.bio, city: form.city }),
      };
      const { data } = await api.patch('/users/profile', payload);
      setUser(data.user);
      onDone?.(data.user);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={onSubmit}>
      <label className="field-label">{t('name')}</label>
      <input className="field-input" value={form.fullName} onChange={set('fullName')} required />

      <label className="field-label">{t('phone')}</label>
      <input className="field-input" type="tel" placeholder="+380" value={form.phone} onChange={set('phone')} />

      <label className="field-label">{t('photo')}</label>
      <div className="flex items-center gap-3">
        {form.avatar ? (
          <img src={form.avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-full bg-elevated text-2xl text-[color:var(--muted)]">
            {(form.fullName || '·').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border-[1.5px] border-[color:var(--line)] px-4 py-2.5 text-[13px] font-semibold"
          >
            {form.avatar ? t('changePhoto') : t('choosePhoto')}
          </button>
          {form.avatar && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, avatar: '' }))}
              className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-red-500 hover:underline"
            >
              {t('removePhoto')}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickPhoto}
        />
      </div>

      {isCook && (
        <>
          <label className="field-label">{t('bio')}</label>
          <input className="field-input" value={form.bio} onChange={set('bio')} />

          <label className="field-label">{t('cityLabel')}</label>
          <CitySelect value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
        </>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-ember/10 px-3 py-2.5 text-[13px] font-medium text-ember-dark">
          {error}
        </div>
      )}

      <div className="mt-6 flex gap-2.5">
        <button
          type="button"
          onClick={() => onDone?.()}
          className="flex-1 rounded-xl border-[1.5px] border-[color:var(--line)] py-3 text-sm font-semibold"
        >
          {t('cancel')}
        </button>
        <button disabled={busy} className="flex-1 btn-primary">
          {busy ? t('loading') : t('save')}
        </button>
      </div>
    </form>
  );
}
