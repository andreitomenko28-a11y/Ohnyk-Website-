import { prisma } from '../lib/prisma.js';
import { analyticsSchema } from '../validation/schemas.js';

// Orders that never counted as revenue (unpaid / cancelled) — mirrors the
// cook-stats convention so admin totals reconcile with cook dashboards.
const REVENUE_EXCLUDED = ['CANCELLED', 'AWAITING_PAYMENT'];

const round = (n) => Math.round((n || 0) * 100) / 100;

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

// Resolve the [from, to] window from explicit dates or a period preset.
function resolveRange({ period, dateFrom, dateTo }) {
  const to = dateTo ? new Date(dateTo) : new Date();
  let from;
  if (dateFrom) {
    from = new Date(dateFrom);
  } else if (period === 'all') {
    from = new Date(0);
  } else {
    const days = PERIOD_DAYS[period] ?? 30; // default: last 30 days
    from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  }
  return { from, to, period: period ?? (dateFrom ? 'custom' : '30d') };
}

// GET /api/admin/analytics?period=&dateFrom=&dateTo=
// Platform KPIs over a window: order volume, GMV, commission, cook payout,
// active cooks, new users, plus a daily time series for charts.
export async function adminAnalytics(req, res, next) {
  try {
    const params = analyticsSchema.parse(req.query);
    const { from, to, period } = resolveRange(params);

    const orderWhere = { status: { notIn: REVENUE_EXCLUDED }, createdAt: { gte: from, lte: to } };

    const [totals, cookGroups, newUsers, series] = await Promise.all([
      prisma.order.aggregate({
        where: orderWhere,
        _count: { _all: true },
        _sum: { total: true, commission: true, cookPayout: true, serviceFee: true },
      }),
      prisma.order.groupBy({ by: ['cookId'], where: orderWhere }),
      prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.$queryRaw`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS date,
               COUNT(*)::int AS orders,
               COALESCE(SUM("total"), 0)::float AS gmv,
               COALESCE(SUM("commission"), 0)::float AS commission
        FROM "Order"
        WHERE "status" NOT IN ('CANCELLED', 'AWAITING_PAYMENT')
          AND "createdAt" >= ${from} AND "createdAt" <= ${to}
        GROUP BY date_trunc('day', "createdAt")
        ORDER BY date_trunc('day', "createdAt") ASC
      `,
    ]);

    res.json({
      range: { from, to, period },
      totals: {
        orders: totals._count._all,
        gmv: round(totals._sum.total), // gross merchandise value (customer paid)
        commission: round(totals._sum.commission),
        cookPayout: round(totals._sum.cookPayout),
        serviceFee: round(totals._sum.serviceFee),
        activeCooks: cookGroups.length,
        newUsers,
      },
      series: series.map((r) => ({ date: r.date, orders: r.orders, gmv: round(r.gmv), commission: round(r.commission) })),
    });
  } catch (err) {
    next(err);
  }
}
