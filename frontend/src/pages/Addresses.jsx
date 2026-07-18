import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import AddressCard from '../components/AddressCard.jsx';
import CitySelect from '../components/CitySelect.jsx';
import { MVP_CITY } from '../lib/cities.js';

const BLANK = { city: MVP_CITY, street: '', building: '', apartment: '', postalCode: '' };

export default function Addresses() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/users/addresses');
      setAddresses(data.addresses);
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/users/addresses', form);
      setForm(BLANK);
      setAdding(false);
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(id) {
    setBusy(true);
    try {
      await api.put(`/users/addresses/${id}/default`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setBusy(true);
    try {
      await api.delete(`/users/addresses/${id}`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="relative lg:mx-auto lg:max-w-[760px]">
      <header className="flex items-center gap-3 px-5 pb-3 pt-5">
        <button onClick={() => navigate('/profile')} className="text-2xl leading-none">
          ‹
        </button>
        <div className="font-display text-xl font-bold">{t('addressesTitle')}</div>
      </header>

      <div className="space-y-3 px-5 pt-1">
        {loading ? (
          <div className="py-16 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>
        ) : addresses.length === 0 && !adding ? (
          <div className="py-12 text-center text-sm text-[color:var(--muted)]">
            {t('noAddresses')}
          </div>
        ) : (
          addresses.map((a) => (
            <AddressCard
              key={a.id}
              address={a}
              busy={busy}
              onMakeDefault={makeDefault}
              onDelete={remove}
            />
          ))
        )}

        {adding ? (
          <form
            onSubmit={create}
            className="rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card"
          >
            <label className="field-label">{t('cityLabel')}</label>
            <CitySelect value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
            <label className="field-label">{t('street')}</label>
            <input className="field-input" value={form.street} onChange={set('street')} required />
            <div className="flex gap-2.5">
              <div className="flex-1">
                <label className="field-label">{t('building')}</label>
                <input className="field-input" value={form.building} onChange={set('building')} required />
              </div>
              <div className="flex-1">
                <label className="field-label">{t('apartment')}</label>
                <input className="field-input" value={form.apartment} onChange={set('apartment')} />
              </div>
            </div>
            <label className="field-label">{t('postalCode')}</label>
            <input className="field-input" value={form.postalCode} onChange={set('postalCode')} />

            {error && (
              <div className="mt-4 rounded-lg bg-ember/10 px-3 py-2.5 text-[13px] font-medium text-ember-dark">
                {error}
              </div>
            )}

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setForm(BLANK);
                }}
                className="flex-1 rounded-xl border-[1.5px] border-[color:var(--line)] py-3 text-sm font-semibold"
              >
                {t('cancel')}
              </button>
              <button disabled={busy} className="flex-1 btn-primary">
                {busy ? t('loading') : t('save')}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full rounded-2xl border-[1.5px] border-dashed border-[color:var(--line)] py-3.5 text-sm font-semibold text-ember"
          >
            + {t('addAddress')}
          </button>
        )}
      </div>

    </div>
  );
}
