import { useEffect, useState, useCallback } from 'react';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import AdminShell from '../components/AdminShell.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

const STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'];

const STATUS_STYLE = {
  PENDING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  VERIFIED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  REJECTED: 'bg-red-500/15 text-red-500',
};

export default function AdminCooks() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // { cook, action }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/cooks', {
        params: { ...(q.trim() && { q: q.trim() }), ...(status && { status }) },
      });
      setRows(data.cooks);
      setTotal(data.total);
      setError('');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    const id = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, q]);

  async function runAction(reason) {
    const { cook, action } = confirm;
    await api
      .post(`/admin/cooks/${cook.id}/${action}`, action === 'reject' ? { reason } : undefined)
      .catch((e) => setError(apiError(e)));
    setConfirm(null);
    await load();
  }

  const statusLabel = (s) =>
    ({ PENDING: t('statusPending'), VERIFIED: t('statusVerified'), REJECTED: t('statusRejected') })[s] || s;

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          className="field-input !mt-0 min-w-[220px] flex-1"
          placeholder={t('adminSearch')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="field-input !mt-0 !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('adminStatus')}: {t('adminAll')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
      </div>

      {error && <div className="mb-3 rounded-lg bg-ember/10 px-3 py-2 text-[13px] font-medium text-ember-dark">{error}</div>}

      <div className="overflow-x-auto rounded-card border border-[color:var(--line)] bg-surface shadow-card">
        <table className="w-full min-w-[720px] text-[13.5px]">
          <thead>
            <tr className="border-b border-[color:var(--line)] text-left text-[color:var(--muted)]">
              <Th>{t('adminName')}</Th>
              <Th>{t('adminEmail')}</Th>
              <Th>{t('cityLabel')}</Th>
              <Th>{t('adminStatus')}</Th>
              <Th>{t('adminRegistered')}</Th>
              <Th className="text-right"> </Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-[color:var(--muted)]">{t('loading')}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-[color:var(--muted)]">{t('adminNoResults')}</td></tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-b border-[color:var(--line)] last:border-0">
                  <Td className="font-semibold">{c.displayName || c.fullName}</Td>
                  <Td className="text-[color:var(--muted)]">{c.email}</Td>
                  <Td className="text-[color:var(--muted)]">{c.city}</Td>
                  <Td>
                    <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${STATUS_STYLE[c.verificationStatus] || ''}`}>
                      {statusLabel(c.verificationStatus)}
                    </span>
                  </Td>
                  <Td className="text-[color:var(--muted)]">
                    {new Date(c.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'uk-UA')}
                  </Td>
                  <Td className="text-right">
                    {c.verificationStatus !== 'VERIFIED' && (
                      <button onClick={() => setConfirm({ cook: c, action: 'verify' })} className="mr-2 rounded-lg border border-[color:var(--line)] px-3 py-1.5 text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {t('adminVerify')}
                      </button>
                    )}
                    {c.verificationStatus !== 'REJECTED' && (
                      <button onClick={() => setConfirm({ cook: c, action: 'reject' })} className="rounded-lg border border-[color:var(--line)] px-3 py-1.5 text-[12.5px] font-semibold text-red-500">
                        {t('adminReject')}
                      </button>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[12px] text-[color:var(--muted)]">{total}</div>

      {confirm && (
        <ConfirmModal
          title={confirm.action === 'verify' ? t('adminVerify') : t('adminReject')}
          message={(confirm.cook.displayName || confirm.cook.fullName) + ' · ' + confirm.cook.email}
          confirmLabel={confirm.action === 'verify' ? t('adminVerify') : t('adminReject')}
          withReason={confirm.action === 'reject'}
          danger={confirm.action === 'reject'}
          onConfirm={runAction}
          onClose={() => setConfirm(null)}
        />
      )}
    </AdminShell>
  );
}

function Th({ children, className = '' }) {
  return <th className={`px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide ${className}`}>{children}</th>;
}
function Td({ children, className = '' }) {
  return <td className={`px-4 py-2.5 ${className}`}>{children}</td>;
}
