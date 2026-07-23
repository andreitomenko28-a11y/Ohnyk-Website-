import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useI18n } from '../i18n/index.jsx';
import api from '../api/client.js';
import AdminShell from '../components/AdminShell.jsx';

const EMBER = '#e8722c';
const GREEN = '#10b981';
const PERIODS = ['7d', '30d', '90d', 'all'];

export default function AdminAnalytics() {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get('/admin/analytics', { params: { period } })
      .then(({ data }) => active && setData(data))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [period]);

  const money = (n) => `${Math.round(n || 0).toLocaleString(lang === 'en' ? 'en-US' : 'uk-UA')} ₴`;
  const series = (data?.series || []).map((r) => ({ ...r, label: r.date.slice(5) })); // MM-DD

  return (
    <AdminShell>
      {/* Period selector */}
      <div className="mb-5 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full border-[1.5px] px-4 py-2 text-[13px] font-semibold transition-colors ${
              period === p ? 'border-ember bg-ember text-on-accent' : 'border-[color:var(--line)] text-fg'
            }`}
          >
            {t(`adminPeriod${p === 'all' ? 'All' : p}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[color:var(--muted)]">{t('loading')}</div>
      ) : !data ? (
        <div className="py-16 text-center text-sm text-[color:var(--muted)]">{t('error')}</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label={t('adminOrders')} value={data.totals.orders} />
            <Stat label={t('adminGmv')} value={money(data.totals.gmv)} />
            <Stat label={t('adminCommission')} value={money(data.totals.commission)} accent />
            <Stat label={t('adminPayout')} value={money(data.totals.cookPayout)} />
            <Stat label={t('adminActiveCooks')} value={data.totals.activeCooks} />
            <Stat label={t('adminNewUsers')} value={data.totals.newUsers} />
          </div>

          {/* Orders per day */}
          <ChartCard title={t('adminOrdersByDay')}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="ord" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={EMBER} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={EMBER} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="orders" name={t('adminOrders')} stroke={EMBER} strokeWidth={2} fill="url(#ord)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Revenue & commission per day */}
          <ChartCard title={t('adminRevenueByDay')}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(v)} />
                <Line type="monotone" dataKey="gmv" name={t('adminGmv')} stroke={EMBER} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="commission" name={t('adminCommission')} stroke={GREEN} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </AdminShell>
  );
}

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  fontSize: 12,
  color: 'var(--fg)',
};

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">{label}</div>
      <div className={`mt-1 font-display text-[20px] font-bold ${accent ? 'text-ember' : ''}`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <section className="mt-5 rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
      <h2 className="mb-3 font-display text-[15px] font-bold">{title}</h2>
      <div className="text-[color:var(--muted)]">{children}</div>
    </section>
  );
}
