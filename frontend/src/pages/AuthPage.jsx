import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { apiError } from '../api/client.js';
import BrandMark from '../components/BrandMark.jsx';
import LangSwitch from '../components/LangSwitch.jsx';

// Combined Login / Register screen with tab switching — mirrors the mockup.
export default function AuthPage({ initialTab = 'login' }) {
  const [tab, setTab] = useState(initialTab);
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 text-center">
          <BrandMark className="text-[28px]" />
          <div className="mt-1 text-[13px] text-[color:var(--muted)]">{t('tag')}</div>
        </div>

        <div className="overflow-hidden rounded-card border border-[color:var(--line)] bg-white shadow-card">
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
        active ? 'text-soot' : 'text-[color:var(--muted)]'
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
          icon="🛒"
          label={t('roleBuyer')}
          sub={t('roleBuyerSub')}
        />
        <RoleOption
          selected={role === 'COOK'}
          onClick={() => setRole('COOK')}
          icon="👩‍🍳"
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

function RoleOption({ selected, onClick, icon, label, sub }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border-[1.5px] px-2.5 py-3 text-center transition-all ${
        selected ? 'border-ember bg-ember/[0.06]' : 'border-[color:var(--line)]'
      }`}
    >
      <span className="mb-1 block text-xl">{icon}</span>
      <span className="block text-[13px] font-semibold">{label}</span>
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
