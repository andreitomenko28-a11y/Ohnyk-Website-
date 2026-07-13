import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import { FlameMark } from '../components/Logo.jsx';
import Wordmark from '../components/Wordmark.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import {
  ChefHatIcon,
  VerifiedBadge,
  MapPinIcon,
  LogoutIcon,
  FoodIcon,
  CartIcon,
} from '../components/icons.jsx';

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
  const { user, refreshUser, logout } = useAuth();
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
    <div className="min-h-screen">
      {/* Top bar — static (in flow) so it never overlaps content, incl. in
          mobile in-app webviews where a translucent sticky header mispositions. */}
      <header className="border-b border-[color:var(--line)] bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <span className="inline-flex items-center gap-2 text-[20px]">
            <FlameMark className="h-7 w-7" />
            <Wordmark />
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--line)] px-3 py-2 text-[13px] font-semibold text-[color:var(--muted)] transition-colors hover:text-fg"
            >
              <LogoutIcon className="h-4 w-4" />
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
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
          <DocStep cook={cook} refreshUser={refreshUser} t={t} />
        </section>

        {/* Profile details */}
        <ProfileSection cook={cook} refreshUser={refreshUser} t={t} />

        {/* Locked previews for upcoming modules */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <LockedCard Icon={FoodIcon} label={t('menuSoon')} enabled={verified} />
          <LockedCard Icon={CartIcon} label={t('ordersSoon')} enabled={verified} />
        </div>

        <div className="mt-6">
          <LangSwitch />
        </div>
      </main>
    </div>
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

function LockedCard({ Icon, label, enabled }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-card border border-dashed border-[color:var(--line)] p-4 ${
        enabled ? '' : 'opacity-60'
      }`}
    >
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-elevated text-[color:var(--muted)]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[13.5px] font-medium text-[color:var(--muted)]">{label}</span>
    </div>
  );
}
