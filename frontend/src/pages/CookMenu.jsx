import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import CookShell from '../components/CookShell.jsx';
import { FoodIcon, EditIcon, TrashIcon } from '../components/icons.jsx';

const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_LABELS = {
  uk: { MON: 'Пн', TUE: 'Вт', WED: 'Ср', THU: 'Чт', FRI: 'Пт', SAT: 'Сб', SUN: 'Нд' },
  en: { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun' },
};

export default function CookMenu() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const verified = user?.cook?.verificationStatus === 'VERIFIED';

  const [dishes, setDishes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(verified);
  const [editing, setEditing] = useState(null); // dish (edit), {} (new), or null (closed)

  const loadDishes = useCallback(async () => {
    const { data } = await api.get('/cook/dishes');
    setDishes(data.dishes);
  }, []);

  useEffect(() => {
    if (!verified) return;
    let active = true;
    (async () => {
      try {
        const [d, c] = await Promise.all([api.get('/cook/dishes'), api.get('/categories')]);
        if (!active) return;
        setDishes(d.data.dishes);
        setCategories(c.data.categories);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [verified]);

  if (!verified) {
    return (
      <CookShell>
        <div className="rounded-card border border-dashed border-[color:var(--line)] bg-surface p-8 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-elevated text-[color:var(--muted)]">
            <FoodIcon className="h-6 w-6" />
          </span>
          <h2 className="font-display text-[17px] font-bold">{t('menuLocked')}</h2>
          <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-[color:var(--muted)]">{t('menuLockedHint')}</p>
          <Link to="/cook" className="btn-primary mx-auto mt-5 !w-auto !px-5 inline-block">
            {t('toProfile')}
          </Link>
        </div>
      </CookShell>
    );
  }

  return (
    <CookShell>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold">{t('menuTitle')}</h1>
        <button onClick={() => setEditing({})} className="btn-primary !w-auto !px-4 !py-2.5 text-[14px]">
          + {t('addDish')}
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-[color:var(--muted)]">…</div>
      ) : dishes.length === 0 ? (
        <div className="rounded-card border border-dashed border-[color:var(--line)] bg-surface p-8 text-center">
          <h2 className="font-display text-[16px] font-bold">{t('emptyMenu')}</h2>
          <p className="mt-1 text-[13.5px] text-[color:var(--muted)]">{t('emptyMenuHint')}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {dishes.map((dish) => (
            <DishCard key={dish.id} dish={dish} lang={lang} t={t} onEdit={() => setEditing(dish)} />
          ))}
        </div>
      )}

      {editing !== null && (
        <DishForm
          dish={editing}
          categories={categories}
          t={t}
          lang={lang}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await loadDishes();
            setEditing(null);
          }}
          onDeleted={async () => {
            await loadDishes();
            setEditing(null);
          }}
        />
      )}
    </CookShell>
  );
}

function daysSummary(days, lang, t) {
  if (!days || days.length === 0) return t('everyDay');
  const labels = DAY_LABELS[lang] || DAY_LABELS.uk;
  return DAY_ORDER.filter((d) => days.includes(d)).map((d) => labels[d]).join(', ');
}

function DishCard({ dish, lang, t, onEdit }) {
  return (
    <div className="flex gap-3 rounded-card border border-[color:var(--line)] bg-surface p-3 shadow-card">
      {dish.image ? (
        <img src={dish.image} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-elevated text-[color:var(--muted)]">
          <FoodIcon className="h-7 w-7" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-display text-[15px] font-bold">{dish.name}</h3>
          <span className="shrink-0 font-bold text-ember">{dish.price} ₴</span>
        </div>
        {dish.category && (
          <span className="mt-0.5 inline-block text-[12px] text-[color:var(--muted)]">
            {dish.category.emoji} {dish.category.name}
          </span>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              dish.isAvailable
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-[color:var(--elevated)] text-[color:var(--muted)]'
            }`}
          >
            {dish.isAvailable ? t('inStock') : t('outOfStock')}
          </span>
          <span className="text-[11px] text-[color:var(--muted)]">{daysSummary(dish.availableDays, lang, t)}</span>
        </div>
        <button
          onClick={onEdit}
          className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-ember hover:underline"
        >
          <EditIcon className="h-3.5 w-3.5" />
          {t('editDishTitle')}
        </button>
      </div>
    </div>
  );
}

function DishForm({ dish, categories, t, lang, onClose, onSaved, onDeleted }) {
  const isNew = !dish.id;
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    name: dish.name || '',
    description: dish.description || '',
    price: dish.price ?? '',
    categoryId: dish.categoryId || '',
    isAvailable: dish.isAvailable ?? true,
    availableDays: dish.availableDays || [],
    availableFrom: dish.availableFrom || '',
    availableUntil: dish.availableUntil || '',
  });
  const [photos, setPhotos] = useState(dish.photos || []); // existing (edit mode)
  const [staged, setStaged] = useState([]); // File objects to upload
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const labels = DAY_LABELS[lang] || DAY_LABELS.uk;

  function toggleDay(d) {
    setForm((f) => ({
      ...f,
      availableDays: f.availableDays.includes(d)
        ? f.availableDays.filter((x) => x !== d)
        : [...f.availableDays, d],
    }));
  }

  async function removeExistingPhoto(photoId) {
    try {
      const { data } = await api.delete(`/cook/dishes/${dish.id}/photos/${photoId}`);
      setPhotos(data.dish.photos);
    } catch (e) {
      setErr(apiError(e));
    }
  }

  async function save(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        price: form.price,
        categoryId: form.categoryId,
        isAvailable: form.isAvailable,
        availableDays: form.availableDays,
        availableFrom: form.availableFrom,
        availableUntil: form.availableUntil,
      };
      let dishId = dish.id;
      if (isNew) {
        const { data } = await api.post('/cook/dishes', payload);
        dishId = data.dish.id;
      } else {
        await api.put(`/cook/dishes/${dishId}`, payload);
      }
      if (staged.length) {
        const fd = new FormData();
        staged.forEach((f) => fd.append('photos', f));
        await api.post(`/cook/dishes/${dishId}/photos`, fd);
      }
      await onSaved();
    } catch (e2) {
      setErr(apiError(e2));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(t('deleteConfirm'))) return;
    setBusy(true);
    try {
      await api.delete(`/cook/dishes/${dish.id}`);
      await onDeleted();
    } catch (e) {
      setErr(apiError(e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-card border border-[color:var(--line)] bg-surface p-5 shadow-card sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[18px] font-bold">{isNew ? t('newDish') : t('editDishTitle')}</h2>
          <button onClick={onClose} className="text-[color:var(--muted)] hover:text-fg">✕</button>
        </div>

        <form onSubmit={save}>
          <label className="field-label">{t('dishName')}</label>
          <input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />

          <label className="field-label">{t('dishDesc')}</label>
          <textarea className="field-input min-h-[64px] resize-y" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="field-label">{t('dishPrice')}</label>
              <input className="field-input" type="number" min="1" step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="flex-1">
              <label className="field-label">{t('dishCategory')}</label>
              <select className="field-input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">{t('noCategory')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Availability toggle */}
          <label className="mt-4 flex items-center gap-2.5 text-[14px] font-semibold">
            <input type="checkbox" className="h-4 w-4 accent-[color:var(--ember)]" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} />
            {t('availableToggle')}
          </label>

          {/* Schedule */}
          <label className="field-label">{t('schedule')}</label>
          <div className="flex flex-wrap gap-1.5">
            {DAY_ORDER.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => toggleDay(d)}
                className={`h-9 w-11 rounded-lg border text-[12.5px] font-semibold transition-colors ${
                  form.availableDays.includes(d)
                    ? 'border-ember bg-ember/10 text-ember'
                    : 'border-[color:var(--line)] text-[color:var(--muted)]'
                }`}
              >
                {labels[d]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11.5px] text-[color:var(--muted)]">{t('scheduleHint')}</p>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-[13px] text-[color:var(--muted)]">{t('timeFrom')}</span>
            <input type="time" className="field-input !w-auto" value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })} />
            <span className="text-[13px] text-[color:var(--muted)]">{t('timeTo')}</span>
            <input type="time" className="field-input !w-auto" value={form.availableUntil} onChange={(e) => setForm({ ...form, availableUntil: e.target.value })} />
          </div>

          {/* Photos */}
          <label className="field-label">{t('photos')}</label>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative">
                <img src={p.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                <button type="button" onClick={() => removeExistingPhoto(p.id)} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-[11px] text-white">✕</button>
              </div>
            ))}
            {staged.map((f, i) => (
              <div key={i} className="relative">
                <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded-lg object-cover opacity-70" />
                <button type="button" onClick={() => setStaged((s) => s.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-[11px] text-white">✕</button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-[color:var(--line)] text-[color:var(--muted)] hover:border-ember hover:text-ember"
            >
              +
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                // Capture files synchronously — the updater runs later, after we
                // reset the input value below (otherwise e.target.files is empty).
                const picked = Array.from(e.target.files || []);
                setStaged((s) => [...s, ...picked]);
                if (fileRef.current) fileRef.current.value = '';
              }}
            />
          </div>

          {err && <p className="mt-3 text-[12.5px] text-red-500">{err}</p>}

          <div className="mt-5 flex items-center gap-2">
            <button className="btn-primary !w-auto !px-5" disabled={busy}>
              {busy ? '…' : t('save')}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border border-[color:var(--line)] px-4 py-2.5 text-[14px] font-semibold text-[color:var(--muted)]">
              {t('cancel')}
            </button>
            {!isNew && (
              <button type="button" onClick={remove} disabled={busy} className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-red-500 hover:underline">
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
