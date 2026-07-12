import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

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
    city: user.cook?.city || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

      <label className="field-label">{t('photoUrl')}</label>
      <input className="field-input" placeholder="https://..." value={form.avatar} onChange={set('avatar')} />

      {isCook && (
        <>
          <label className="field-label">{t('bio')}</label>
          <input className="field-input" value={form.bio} onChange={set('bio')} />

          <label className="field-label">{t('cityLabel')}</label>
          <input className="field-input" value={form.city} onChange={set('city')} />
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
