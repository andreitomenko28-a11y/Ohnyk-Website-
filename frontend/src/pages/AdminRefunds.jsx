import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import AdminShell from '../components/AdminShell.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

// The manual refund queue.
//
// Cancelling a paid order does not reverse the charge — there is no automatic
// refund yet — so the money is parked as REFUND_PENDING and settled here by
// hand. The "owed" figure is the reason this page exists: it is real money the
// marketplace is holding on behalf of buyers.
export default function AdminRefunds() {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState('REFUND_PENDING');
  const [rows, setRows] = useState([]);
  const [owed, setOwed] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // the refund being settled

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/refunds', { params: { status } });
      setRows(data.refunds);
      setOwed(data.owed);
      setTotal(data.total);
      setError('');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  // `note` is the admin's own reference for the transfer they just made — it is
  // stored on the audit log entry, not shown to the buyer.
  async function settle(note) {
    try {
      await api.post(`/admin/refunds/${confirm.paymentId}/complete`, note ? { note } : {});
    } catch (err) {
      setError(apiError(err));
    }
    setConfirm(null);
    await load();
  }

  const date = (v) => (v ? new Date(v).toLocaleDateString(lang === 'en' ? 'en-GB' : 'uk-UA') : '—');

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <select
          className="field-input !mt-0 !w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="REFUND_PENDING">{t('refundPending')}</option>
          <option value="REFUNDED">{t('refundDone')}</option>
        </select>

        <span className="ml-auto rounded-lg bg-ember/10 px-3 py-2 text-[13px] font-semibold text-ember">
          {t('refundOwed')}: {owed} ₴
        </span>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-ember/10 px-3 py-2 text-[13px] font-medium text-ember-dark">{error}</div>
      )}

      <div className="overflow-x-auto rounded-card border border-[color:var(--line)] bg-surface shadow-card">
        <table className="w-full min-w-[720px] text-[13.5px]">
          <thead>
            <tr className="border-b border-[color:var(--line)] text-left text-[color:var(--muted)]">
              <Th>{t('refundOrder')}</Th>
              <Th>{t('refundBuyer')}</Th>
              <Th>{t('adminCooks')}</Th>
              <Th>{t('refundAmount')}</Th>
              <Th>{t('refundReason')}</Th>
              <Th>{status === 'REFUNDED' ? t('refundSettledAt') : t('refundCancelledAt')}</Th>
              <Th className="text-right"> </Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-[color:var(--muted)]">{t('loading')}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-[color:var(--muted)]">{t('refundNone')}</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.paymentId} className="border-b border-[color:var(--line)] last:border-0">
                  <Td className="font-mono text-[12.5px]">#{r.orderId.slice(0, 8)}</Td>
                  <Td>
                    <div className="font-semibold">{r.buyer?.name ?? '—'}</div>
                    <div className="text-[12px] text-[color:var(--muted)]">
                      {r.buyer?.email}{r.buyer?.phone ? ` · ${r.buyer.phone}` : ''}
                    </div>
                  </Td>
                  <Td className="text-[color:var(--muted)]">{r.cook?.name ?? '—'}</Td>
                  <Td className="font-bold">{r.amount} ₴</Td>
                  <Td className="text-[color:var(--muted)]">{r.reason ?? '—'}</Td>
                  <Td className="text-[color:var(--muted)]">
                    {date(status === 'REFUNDED' ? r.refundedAt : r.cancelledAt)}
                  </Td>
                  <Td className="text-right">
                    {r.status === 'REFUND_PENDING' && (
                      <button
                        onClick={() => setConfirm(r)}
                        className="rounded-lg border border-[color:var(--line)] px-3 py-1.5 text-[12.5px] font-semibold text-ember"
                      >
                        {t('refundMarkDone')}
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
          title={t('refundMarkDone')}
          message={`${confirm.amount} ₴ · ${confirm.buyer?.name ?? ''} ${confirm.buyer?.email ?? ''} — ${t('refundConfirmHint')}`}
          confirmLabel={t('refundMarkDone')}
          withReason
          onConfirm={settle}
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
