import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';

// Two-step password reset: request a code, then set a new password.
// The dev backend returns the token in the response so the code is prefilled.
export default function PasswordReset() {
  const { t } = useI18n();
  const [step, setStep] = useState('request'); // request | confirm | done
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestCode(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/password-reset', { email });
      // In dev the token comes back so we can prefill it.
      if (data.token) setToken(data.token);
      setStep('confirm');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/password-reset-confirm', { token, password });
      setStep('done');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-5 text-center font-display text-[17px] font-bold">{t('resetTitle')}</div>

      {step === 'request' && (
        <form onSubmit={requestCode} className="animate-[fade_.3s_ease]">
          <div className="mb-4 text-center text-[13px] text-[color:var(--muted)]">
            {t('resetHint')}
          </div>
          <label className="field-label">{t('email')}</label>
          <input
            className="field-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Error error={error} />
          <button disabled={busy} className="btn-primary mt-6">
            {busy ? t('loading') : t('sendCode')}
          </button>
        </form>
      )}

      {step === 'confirm' && (
        <form onSubmit={confirmReset} className="animate-[fade_.3s_ease]">
          <label className="field-label">{t('resetCode')}</label>
          <input
            className="field-input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
          <label className="field-label">{t('newPassword')}</label>
          <input
            className="field-input"
            type="password"
            placeholder={t('pwHint')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <Error error={error} />
          <button disabled={busy} className="btn-primary mt-6">
            {busy ? t('loading') : t('save')}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="animate-[fade_.3s_ease] text-center">
          <div className="mb-4 text-4xl">✅</div>
          <div className="mb-6 text-sm text-[color:var(--muted)]">{t('resetDone')}</div>
        </div>
      )}

      <div className="mt-5 text-center">
        <Link to="/login" className="text-[13px] font-semibold text-ember">
          {t('backToLogin')}
        </Link>
      </div>
    </div>
  );
}

function Error({ error }) {
  if (!error) return null;
  return (
    <div className="mt-4 rounded-lg bg-ember/10 px-3 py-2.5 text-[13px] font-medium text-ember-dark">
      {error}
    </div>
  );
}
