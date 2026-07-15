import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import CookShell from '../components/CookShell.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import { ChefHatIcon, VerifiedBadge, MapPinIcon, FoodIcon, CartIcon } from '../components/icons.jsx';

// Small inline check for completed steps.
function Check({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Cook onboarding / verification hub (Module 3.1). Menu (3.2) and orders (3.3)
// arrive as unlockable sections once verified.
export default function CookOnboarding() {
  const { user, refreshUser } = useAuth();
  const { t } = useI18n();
  const cook = user.cook || {};

  const statusKey =
    cook.verificationStatus === 'VERIFIED'
      ? 'statusVerified'
      : cook.verificationStatus === 'REJECTED'
        ? 'statusRejected'
        : 'statusPending';
  const noteKey =
    cook.verificationStatus === 'VERIFIED'
      ? 'verifyVerifiedNote'
      : cook.verificationStatus === 'REJECTED'
        ? 'verifyRejectedNote'
        : 'verifyPendingNote';
  const verified = cook.verificationStatus === 'VERIFIED';

  return (
    <CookShell>
        {/* Title + status */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-ember/10 text-ember">
              <ChefHatIcon className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-display text-[22px] font-bold leading-tight">{t('cookAreaTitle')}</h1>
              <p className="text-[13px] text-[color:var(--muted)]">{cook.displayName || user.fullName}</p>
            </div>
          </div>
          <StatusBadge statusKey={statusKey} verified={verified} t={t} />
        </div>

        {/* Status note */}
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed ${
            verified
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : cook.verificationStatus === 'REJECTED'
                ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                : 'border-ember/30 bg-ember/10 text-ember-dark'
          }`}
        >
          {t(noteKey)}
        </div>

        {/* Onboarding steps */}
        <section className="rounded-card border border-[color:var(--line)] bg-surface p-5 shadow-card">
          <h2 className="mb-1 font-display text-[16px] font-bold">{t('cookOnboarding')}</h2>
          <p className="mb-5 text-[13px] text-[color:var(--muted)]">{t('cookOnboardingSub')}</p>

          <PhotoStep cook={cook} refreshUser={refreshUser} t={t} />
          <div className="my-4 h-px bg-[color:var(--line)]" />
          <PhoneStep cook={cook} refreshUser={refreshUser} t={t} />
          <div className="my-4 h-px bg-[color:var(--line)]" />
          <IdentityStep cook={cook} refreshUser={refreshUser} t={t} />
          <div className="my-4 h-px bg-[color:var(--line)]" />
          <DocStep cook={cook} refreshUser={refreshUser} t={t} />
        </section>

        {/* Profile details */}
        <ProfileSection cook={cook} refreshUser={refreshUser} t={t} />

        {/* Menu now lives in its own tab; orders arrive in Module 3.3 */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <LockedCard Icon={FoodIcon} label={verified ? t('menuOpenHint') : t('menuSoon')} enabled={verified} to={verified ? '/cook/menu' : undefined} />
          <LockedCard Icon={CartIcon} label={verified ? t('ordersOpenHint') : t('ordersSoon')} enabled={verified} to={verified ? '/cook/orders' : undefined} />
        </div>

        <div className="mt-6">
          <LangSwitch />
        </div>
    </CookShell>
  );
}

function StatusBadge({ statusKey, verified, t }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold ${
        verified
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : statusKey === 'statusRejected'
            ? 'bg-red-500/15 text-red-600 dark:text-red-400'
            : 'bg-ember/15 text-ember'
      }`}
    >
      {verified && <VerifiedBadge className="h-4 w-4" />}
      {t(statusKey)}
    </span>
  );
}

// --- Steps -------------------------------------------------------------------

function StepRow({ done, title, children }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
          done ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-elevated text-[color:var(--muted)]'
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">{title}</p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

function PhotoStep({ cook, refreshUser, t }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await api.post('/cook/profile/photo', fd);
      await refreshUser();
    } catch (er) {
      setErr(apiError(er));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <StepRow done={!!cook.avatar} title={t('stepPhoto')}>
      <div className="flex items-center gap-3">
        {cook.avatar ? (
          <img src={cook.avatar} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-full bg-elevated text-[color:var(--muted)]">
            <ChefHatIcon className="h-6 w-6" />
          </span>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-lg border border-[color:var(--line)] px-3.5 py-2 text-[13px] font-semibold transition-colors hover:border-ember hover:text-ember disabled:opacity-60"
        >
          {busy ? t('loading') : cook.avatar ? t('changePhoto') : t('uploadPhoto')}
        </button>
      </div>
      {err && <p className="mt-2 text-[12.5px] text-red-500">{err}</p>}
    </StepRow>
  );
}

function PhoneStep({ cook, refreshUser, t }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send() {
    setErr('');
    setBusy(true);
    try {
      const { data } = await api.post('/cook/verification/phone/request');
      if (data.devCode) setCode(data.devCode); // stub convenience
      setSent(true);
    } catch (er) {
      setErr(apiError(er));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setErr('');
    setBusy(true);
    try {
      await api.post('/cook/verification/phone/confirm', { code });
      await refreshUser();
    } catch (er) {
      setErr(apiError(er));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepRow done={!!cook.phoneVerified} title={cook.phoneVerified ? t('stepPhoneDone') : t('stepPhone')}>
      {!cook.phoneVerified && (
        <>
          {!sent ? (
            <button
              onClick={send}
              disabled={busy}
              className="rounded-lg border border-[color:var(--line)] px-3.5 py-2 text-[13px] font-semibold transition-colors hover:border-ember hover:text-ember disabled:opacity-60"
            >
              {busy ? t('loading') : t('sendCode')}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="field-input !w-28 text-center tracking-[0.3em]"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="0000"
                inputMode="numeric"
                maxLength={6}
              />
              <button onClick={confirm} disabled={busy || !code} className="btn-primary !w-auto !px-4 !py-2.5 text-[13px]">
                {t('confirmCode')}
              </button>
              <span className="text-[12px] text-[color:var(--muted)]">{t('codeStubHint')}</span>
            </div>
          )}
          {err && <p className="mt-2 text-[12.5px] text-red-500">{err}</p>}
        </>
      )}
    </StepRow>
  );
}

function DocStep({ cook, refreshUser, t }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('document', file);
      await api.post('/cook/verification/document', fd);
      await refreshUser();
    } catch (er) {
      setErr(apiError(er));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const done = !!cook.verificationDocUrl;
  return (
    <StepRow done={done} title={done ? t('stepDocDone') : t('stepDoc')}>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPick} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-lg border border-[color:var(--line)] px-3.5 py-2 text-[13px] font-semibold transition-colors hover:border-ember hover:text-ember disabled:opacity-60"
      >
        {busy ? t('loading') : done ? t('changeDoc') : t('uploadDoc')}
      </button>
      {err && <p className="mt-2 text-[12.5px] text-red-500">{err}</p>}
    </StepRow>
  );
}

// Identity document (passport / driver's licence) uploaded at onboarding.
function IdentityStep({ cook, refreshUser, t }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('document', file);
      await api.post('/cook/verification/identity', fd);
      await refreshUser();
    } catch (er) {
      setErr(apiError(er));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const done = !!cook.identityDocUrl;
  return (
    <StepRow done={done} title={done ? t('stepIdentityDone') : t('stepIdentity')}>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPick} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-lg border border-[color:var(--line)] px-3.5 py-2 text-[13px] font-semibold transition-colors hover:border-ember hover:text-ember disabled:opacity-60"
      >
        {busy ? t('loading') : done ? t('changeIdentity') : t('uploadIdentity')}
      </button>
      {err && <p className="mt-2 text-[12.5px] text-red-500">{err}</p>}
    </StepRow>
  );
}

function ProfileSection({ cook, refreshUser, t }) {
  const [form, setForm] = useState({
    displayName: cook.displayName || '',
    kitchenAddress: cook.kitchenAddress || '',
    deliveryZone: cook.deliveryZone || '',
    bio: cook.bio || '',
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  async function save(e) {
    e.preventDefault();
    setErr('');
    setSaved(false);
    setBusy(true);
    try {
      await api.put('/cook/profile', form);
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (er) {
      setErr(apiError(er));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-6 rounded-card border border-[color:var(--line)] bg-surface p-5 shadow-card">
      <h2 className="mb-4 flex items-center gap-2 font-display text-[16px] font-bold">
        <MapPinIcon className="h-5 w-5 text-ember" />
        {t('cookProfileSection')}
      </h2>

      <label className="field-label">{t('name')}</label>
      <input
        className="field-input"
        value={form.displayName}
        onChange={(e) => setForm({ ...form, displayName: e.target.value })}
        placeholder={t('name')}
      />

      <label className="field-label">{t('cookKitchenAddress')}</label>
      <input
        className="field-input"
        value={form.kitchenAddress}
        onChange={(e) => setForm({ ...form, kitchenAddress: e.target.value })}
        placeholder={t('cookKitchenPlaceholder')}
      />

      <label className="field-label">{t('cookDeliveryZone')}</label>
      <input
        className="field-input"
        value={form.deliveryZone}
        onChange={(e) => setForm({ ...form, deliveryZone: e.target.value })}
        placeholder={t('cookDeliveryPlaceholder')}
      />

      <label className="field-label">{t('cookBioLabel')}</label>
      <textarea
        className="field-input min-h-[80px] resize-y"
        value={form.bio}
        onChange={(e) => setForm({ ...form, bio: e.target.value })}
        placeholder={t('cookBioPlaceholder')}
        maxLength={500}
      />

      <KitchenMedia cook={cook} refreshUser={refreshUser} t={t} />

      {err && <p className="mt-3 text-[12.5px] text-red-500">{err}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button className="btn-primary !w-auto !px-5" disabled={busy}>
          {busy ? t('loading') : t('saveProfile')}
        </button>
        {saved && <span className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">{t('profileSaved')}</span>}
      </div>
    </form>
  );
}

// Optional kitchen photo & video uploads — build buyer trust.
function KitchenMedia({ cook, refreshUser, t }) {
  const photoRef = useRef(null);
  const videoRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  async function upload(kind, file) {
    if (!file) return;
    setErr('');
    setBusy(kind);
    try {
      const fd = new FormData();
      fd.append(kind === 'photo' ? 'photo' : 'video', file);
      await api.post(`/cook/kitchen/${kind}`, fd);
      await refreshUser();
    } catch (er) {
      setErr(apiError(er));
    } finally {
      setBusy('');
      if (photoRef.current) photoRef.current.value = '';
      if (videoRef.current) videoRef.current.value = '';
    }
  }

  const btn =
    'rounded-lg border border-[color:var(--line)] px-3.5 py-2 text-[13px] font-semibold transition-colors hover:border-ember hover:text-ember disabled:opacity-60';

  return (
    <div className="mt-4">
      <label className="field-label">
        {t('kitchenPhotoLabel')} <span className="font-normal text-[color:var(--muted)]">{t('optional')}</span>
      </label>
      <div className="flex items-center gap-3">
        {cook.kitchenPhotoUrl && (
          <img src={cook.kitchenPhotoUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
        )}
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload('photo', e.target.files?.[0])} />
        <button type="button" onClick={() => photoRef.current?.click()} disabled={!!busy} className={btn}>
          {busy === 'photo' ? t('loading') : cook.kitchenPhotoUrl ? t('changeKitchenPhoto') : t('uploadKitchenPhoto')}
        </button>
      </div>

      <label className="field-label">
        {t('kitchenVideoLabel')} <span className="font-normal text-[color:var(--muted)]">{t('optional')}</span>
      </label>
      <div className="flex items-center gap-3">
        {cook.kitchenVideoUrl && (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> {t('kitchenMediaDone')}
          </span>
        )}
        <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => upload('video', e.target.files?.[0])} />
        <button type="button" onClick={() => videoRef.current?.click()} disabled={!!busy} className={btn}>
          {busy === 'video' ? t('loading') : cook.kitchenVideoUrl ? t('changeKitchenVideo') : t('uploadKitchenVideo')}
        </button>
      </div>

      <p className="mt-2.5 text-[12px] leading-relaxed text-[color:var(--muted)]">{t('kitchenTrust')}</p>
      {err && <p className="mt-2 text-[12.5px] text-red-500">{err}</p>}
    </div>
  );
}

function LockedCard({ Icon, label, enabled, to }) {
  const cls = `flex items-center gap-3 rounded-card border border-dashed border-[color:var(--line)] p-4 ${
    enabled ? 'transition-colors hover:border-ember' : 'opacity-60'
  }`;
  const inner = (
    <>
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-elevated text-[color:var(--muted)]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[13.5px] font-medium text-[color:var(--muted)]">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
