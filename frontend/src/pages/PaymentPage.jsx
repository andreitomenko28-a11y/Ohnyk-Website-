import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';

// Payment page for an order. In stub mode it renders a local "gateway"
// (Pay / Cancel). In real mode monobank hosts the page and redirects back
// here, where we poll until the webhook settles the payment.
export default function PaymentPage() {
  const { orderId } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${orderId}/payment`);
      setInfo(data);
      return data;
    } catch (err) {
      setError(apiError(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const status = info?.payment?.status || 'PENDING';
  const settled = status === 'SUCCESS' || status === 'FAILED';

  // While a real payment is pending, poll for the webhook result.
  useEffect(() => {
    if (loading || info?.stub || settled) return;
    timer.current = setInterval(load, 2500);
    return () => clearInterval(timer.current);
  }, [loading, info?.stub, settled, load]);

  async function mockPay(result) {
    setWorking(true);
    setError('');
    try {
      await api.post(`/orders/${orderId}/pay/mock`, { result });
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setWorking(false);
    }
  }

  async function retry() {
    setWorking(true);
    setError('');
    try {
      const { data } = await api.post(`/orders/${orderId}/pay`);
      const url = new URL(data.pageUrl, window.location.origin);
      if (url.origin === window.location.origin) {
        await load();
      } else {
        window.location.assign(data.pageUrl);
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>;
  }

  const amount = info?.total;

  // --- Success --------------------------------------------------------------
  if (status === 'SUCCESS') {
    return (
      <Centered>
        <IconBadge tone="green">
          <path d="M20 6 9 17l-5-5" />
        </IconBadge>
        <div className="mb-1 font-display text-xl font-bold">{t('paySuccessTitle')}</div>
        <div className="mb-3 max-w-sm text-sm text-[color:var(--muted)]">{t('paySuccessHint')}</div>
        <div className="mb-6 text-sm font-semibold">
          {info.cookName} · {amount}₴
        </div>
        <button onClick={() => navigate('/discovery')} className="btn-primary max-w-[240px]">
          {t('keepShopping')}
        </button>
      </Centered>
    );
  }

  // --- Failed ---------------------------------------------------------------
  if (status === 'FAILED') {
    return (
      <Centered>
        <IconBadge tone="red">
          <path d="M18 6 6 18M6 6l12 12" />
        </IconBadge>
        <div className="mb-1 font-display text-xl font-bold">{t('payFailedTitle')}</div>
        <div className="mb-5 max-w-sm text-sm text-[color:var(--muted)]">{t('payFailedHint')}</div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <button onClick={retry} disabled={working} className="btn-primary max-w-[240px]">
          {working ? t('loading') : t('payRetry')}
        </button>
      </Centered>
    );
  }

  // --- Pending: stub gateway ------------------------------------------------
  if (info?.stub) {
    return (
      <div className="relative lg:mx-auto lg:max-w-[600px]">
        <header className="px-5 pb-3 pt-5">
          <div className="font-display text-xl font-bold">{t('payTitle')}</div>
        </header>
        <div className="space-y-4 px-5 pb-6">
          <section className="rounded-card border border-[color:var(--line)] bg-surface p-5 shadow-card">
            <div className="mb-1 text-[13px] text-[color:var(--muted)]">{info.cookName}</div>
            <div className="mb-4 font-display text-3xl font-bold">{amount}₴</div>
            <div className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-600 dark:text-amber-400">
              {t('payMockNote')}
            </div>
            {error && <ErrorBox>{error}</ErrorBox>}
            <button onClick={() => mockPay('success')} disabled={working} className="btn-primary mb-2">
              {working ? t('loading') : t('payNow')}
            </button>
            <button
              onClick={() => mockPay('failure')}
              disabled={working}
              className="w-full rounded-xl border border-[color:var(--line)] py-2.5 text-[14px] font-semibold text-[color:var(--muted)]"
            >
              {t('payCancel')}
            </button>
          </section>
        </div>
      </div>
    );
  }

  // --- Pending: real gateway (awaiting webhook) -----------------------------
  return (
    <Centered>
      <IconBadge tone="amber" spin>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </IconBadge>
      <div className="mb-1 font-display text-xl font-bold">{t('payProcessing')}</div>
      <div className="max-w-sm text-sm text-[color:var(--muted)]">{t('payProcessingHint')}</div>
    </Centered>
  );
}

function Centered({ children }) {
  return (
    <div className="relative lg:mx-auto lg:max-w-[600px]">
      <div className="flex flex-col items-center justify-center px-8 py-20 text-center">{children}</div>
    </div>
  );
}

function IconBadge({ children, tone, spin }) {
  const tones = {
    green: 'bg-emerald-500/15 text-emerald-500',
    red: 'bg-ember/15 text-ember',
    amber: 'bg-amber-500/15 text-amber-500',
  };
  return (
    <span className={`mb-4 grid h-16 w-16 place-items-center rounded-full ${tones[tone]}`}>
      <svg
        viewBox="0 0 24 24"
        className={`h-8 w-8 ${spin ? 'animate-spin' : ''}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </span>
  );
}

function ErrorBox({ children }) {
  return <div className="mb-3 w-full rounded-lg bg-ember/10 px-3 py-2.5 text-[13px] font-medium text-ember-dark">{children}</div>;
}
