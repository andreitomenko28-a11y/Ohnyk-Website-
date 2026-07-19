import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import api from '../api/client.js';

// Telegram notification channel connect/disconnect (Module 6.3). Stub-first:
// linking issues a deep link; the account is connected once the user presses
// Start in the bot (server /start webhook). Status is re-checked on focus.
export default function TelegramConnect() {
  const { t } = useI18n();
  const [linked, setLinked] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const { data } = await api.get('/notifications/telegram/status');
      setLinked(data.linked);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  async function connect() {
    setBusy(true);
    try {
      const { data } = await api.post('/notifications/telegram/link');
      setUrl(data.url);
      window.open(data.url, '_blank', 'noopener');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await api.delete('/notifications/telegram');
      setLinked(false);
      setUrl('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Telegram</div>
          <div className="truncate text-[12.5px] text-[color:var(--muted)]">
            {linked ? t('telegramConnected') : t('telegramHint')}
          </div>
        </div>
        {linked ? (
          <button
            onClick={disconnect}
            disabled={busy}
            className="shrink-0 rounded-lg border border-[color:var(--line)] px-3 py-2 text-[13px] font-semibold text-red-500 disabled:opacity-60"
          >
            {t('telegramDisconnect')}
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={busy}
            className="shrink-0 rounded-lg bg-gradient-to-br from-[color:var(--ember)] to-[color:var(--ember-dark)] px-3 py-2 text-[13px] font-semibold text-[color:var(--on-accent)] disabled:opacity-60"
          >
            {t('telegramConnect')}
          </button>
        )}
      </div>
      {url && !linked && (
        <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--muted)]">{t('telegramOpenHint')}</p>
      )}
    </div>
  );
}
