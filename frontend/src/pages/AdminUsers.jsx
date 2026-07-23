import { useEffect, useState, useCallback } from 'react';
import { useI18n } from '../i18n/index.jsx';
import api, { apiError } from '../api/client.js';
import AdminShell from '../components/AdminShell.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

const ROLES = ['CUSTOMER', 'COOK', 'COURIER', 'ADMIN'];

export default function AdminUsers() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [blocked, setBlocked] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // { user, action }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users', {
        params: { ...(q.trim() && { q: q.trim() }), ...(role && { role }), ...(blocked && { blocked }) },
      });
      setRows(data.users);
      setTotal(data.total);
      setError('');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [q, role, blocked]);

  useEffect(() => {
    const id = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, q]);

  async function runAction(reason) {
    const { user, action } = confirm;
    const url = `/admin/users/${user.id}/${action}`;
    await api.patch(url, action === 'block' ? { reason } : undefined).catch((e) => setError(apiError(e)));
    setConfirm(null);
    await load();
  }

  const roleLabel = (r) =>
    ({ CUSTOMER: t('roleBuyer'), COOK: t('roleCook'), COURIER: t('roleCourier'), ADMIN: 'ADMIN' })[r] || r;

  return (
    <AdminShell>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          className="field-input !mt-0 min-w-[220px] flex-1"
          placeholder={t('adminSearch')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="field-input !mt-0 !w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">{t('adminRole')}: {t('adminAll')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{roleLabel(r)}</option>
          ))}
        </select>
        <select className="field-input !mt-0 !w-auto" value={blocked} onChange={(e) => setBlocked(e.target.value)}>
          <option value="">{t('adminStatus')}: {t('adminAll')}</option>
          <option value="false">{t('adminActive')}</option>
          <option value="true">{t('adminBlocked')}</option>
        </select>
      </div>

      {error && <div className="mb-3 rounded-lg bg-ember/10 px-3 py-2 text-[13px] font-medium text-ember-dark">{error}</div>}

      <div className="overflow-x-auto rounded-card border border-[color:var(--line)] bg-surface shadow-card">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead>
            <tr className="border-b border-[color:var(--line)] text-left text-[color:var(--muted)]">
              <Th>{t('adminName')}</Th>
              <Th>{t('adminEmail')}</Th>
              <Th>{t('adminRole')}</Th>
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
              rows.map((u) => (
                <tr key={u.id} className="border-b border-[color:var(--line)] last:border-0">
                  <Td className="font-semibold">{u.fullName}</Td>
                  <Td className="text-[color:var(--muted)]">{u.email}</Td>
                  <Td>{roleLabel(u.role)}</Td>
                  <Td>
                    {u.isBlocked ? (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11.5px] font-bold text-red-500">
                        {t('adminBlockedBadge')}
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">{t('adminActive')}</span>
                    )}
                  </Td>
                  <Td className="text-[color:var(--muted)]">
                    {new Date(u.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'uk-UA')}
                  </Td>
                  <Td className="text-right">
                    {u.role !== 'ADMIN' &&
                      (u.isBlocked ? (
                        <button onClick={() => setConfirm({ user: u, action: 'unblock' })} className="rounded-lg border border-[color:var(--line)] px-3 py-1.5 text-[12.5px] font-semibold">
                          {t('adminUnblock')}
                        </button>
                      ) : (
                        <button onClick={() => setConfirm({ user: u, action: 'block' })} className="rounded-lg border border-[color:var(--line)] px-3 py-1.5 text-[12.5px] font-semibold text-red-500">
                          {t('adminBlock')}
                        </button>
                      ))}
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
          title={confirm.action === 'block' ? t('adminBlock') : t('adminUnblock')}
          message={confirm.user.fullName + ' · ' + confirm.user.email}
          confirmLabel={confirm.action === 'block' ? t('adminBlock') : t('adminUnblock')}
          withReason={confirm.action === 'block'}
          danger={confirm.action === 'block'}
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
