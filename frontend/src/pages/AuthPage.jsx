import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { apiError } from '../api/client.js';
import BrandMark from '../components/BrandMark.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { BagIcon, ChefHatIcon } from '../components/icons.jsx';

// Combined Login / Register screen with tab switching — mirrors the mockup.
export default function AuthPage({ initialTab = 'login' }) {
  const [tab, setTab] = useState(initialTab);
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-2 flex justify-end">
          <ThemeToggle />
        </div>
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark stacked markClassName="h-[72px] w-[72px]" className="text-[34px]" />
          <div className="mt-3 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ember">
            <span className="h-px w-6 bg-ember/50" />
            {t('tag')}
            <span className="h-px w-6 bg-ember/50" />
          </div>
        </div>

        <div className="overflow-hidden rounded-card border border-[color:var(--line)] bg-surface shadow-card">
          <div className="flex border-b border-[color:var(--line)]">
            <TabButton active={tab === 'login'} onClick={() => setTab('login')}>
              {t('tabLogin')}
            </TabButton>
            <TabButton active={tab === 'register'} onClick={() => setTab('register')}>
              {t('tabRegister')}
            </TabButton>
          </div>

          <div className="px-6 pb-8 pt-7">
            {tab === 'login' ? <LoginForm /> : <RegisterForm />}
          </div>
        </div>

        <LangSwitch />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 py-[18px] font-display text-[15px] font-bold transition-colors ${
        active ? 'text-fg' : 'text-[color:var(--muted)]'
      }`}
    >
      {children}
      {active && (
        <span className="absolute -bottom-px left-[20%] right-[20%] h-[3px] rounded-t-md bg-ember" />
      )}
    </button>
  );
}

function LoginForm() {
  const { t } = useI18n();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.identifier, form.password);
      navigate('/');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="animate-[fade_.3s_ease]">
      <label className="field-label">{t('emailOrPhone')}</label>
      <input
        className="field-input"
        type="text"
        autoComplete="username"
        placeholder="you@example.com"
        value={form.identifier}
        onChange={(e) => setForm({ ...form, identifier: e.target.value })}
        required
      />

      <label className="field-label">{t('password')}</label>
      <input
        className="field-input"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        required
      />

      {error && <ErrorText>{error}</ErrorText>}

      <button className="btn-primary mt-6" disabled={busy}>
        {busy ? t('loading') : t('loginBtn')}
      </button>
      <Link
        to="/reset-password"
        className="mt-4 block text-center text-[13px] font-semibold text-ember"
      >
        {t('forgot')}
      </Link>
    </form>
  );
}

function RegisterForm() {
  const { t } = useI18n();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('CUSTOMER');
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register({ ...form, role });
      navigate('/');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="animate-[fade_.3s_ease]">
      <label className="field-label">{t('roleLabel')}</label>
      <div className="mb-5 flex gap-2.5">
        <RoleOption
          selected={role === 'CUSTOMER'}
          onClick={() => setRole('CUSTOMER')}
          Icon={BagIcon}
          label={t('roleBuyer')}
          sub={t('roleBuyerSub')}
        />
        <RoleOption
          selected={role === 'COOK'}
          onClick={() => setRole('COOK')}
          Icon={ChefHatIcon}
          label={t('roleCook')}
          sub={t('roleCookSub')}
        />
      </div>

      <label className="field-label">{t('name')}</label>
      <input
        className="field-input"
        type="text"
        placeholder="Андрій"
        value={form.fullName}
        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        required
      />

      <label className="field-label">{t('email')}</label>
      <input
        className="field-input"
        type="email"
        placeholder="you@example.com"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        required
      />

      <label className="field-label">{t('phone')}</label>
      <input
        className="field-input"
        type="tel"
        placeholder="+380"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />

      <label className="field-label">{t('password')}</label>
      <input
        className="field-input"
        type="password"
        placeholder={t('pwHint')}
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        minLength={8}
        required
      />

      {error && <ErrorText>{error}</ErrorText>}

      <button className="btn-primary mt-6" disabled={busy}>
        {busy ? t('loading') : t('registerBtn')}
      </button>
      <div className="mt-2.5 text-center text-[11px] leading-relaxed text-[color:var(--muted)]">
        {t('terms')}
      </div>
    </form>
  );
}

function RoleOption({ selected, onClick, Icon, label, sub }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border-[1.5px] px-2.5 py-3 text-center transition-all ${
        selected ? 'border-ember bg-ember/[0.06] text-ember-dark' : 'border-line text-[color:var(--muted)]'
      }`}
    >
      <Icon className="mx-auto mb-1.5 h-6 w-6" />
      <span className="block text-[13px] font-semibold text-fg">{label}</span>
      <span className="mt-0.5 block text-[11px] text-[color:var(--muted)]">{sub}</span>
    </button>
  );
}

function ErrorText({ children }) {
  return (
    <div className="mt-4 rounded-lg bg-ember/10 px-3 py-2.5 text-[13px] font-medium text-ember-dark">
      {children}
    </div>
  );
}
