import { useI18n } from '../i18n/index.jsx';

// Buyer-facing step sequence per delivery method.
const STEPS = {
  PICKUP: ['NEW', 'PREPARING', 'READY', 'DELIVERED'],
  COOK_DELIVERY: ['NEW', 'PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED'],
  COURIER: ['NEW', 'PREPARING', 'READY', 'COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'],
};

// Vertical timeline of an order's progress. Steps at/under the current status
// are "done"; the latest reached one is "current"; the rest are pending.
export default function OrderStatusStepper({ deliveryMethod = 'COURIER', status, timeline = [] }) {
  const { t, lang } = useI18n();
  const steps = STEPS[deliveryMethod] || STEPS.COURIER;

  const timeAt = (code) => {
    const ev = timeline.find((e) => e.status === code);
    return ev ? new Date(ev.at).toLocaleString(lang === 'en' ? 'en-GB' : 'uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
  };

  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-red-500/10 px-4 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-red-500/20 text-red-500">✕</span>
        <div>
          <div className="text-[14px] font-bold text-red-600 dark:text-red-400">{t('stCANCELLED')}</div>
          {timeAt('CANCELLED') && <div className="text-[12px] text-[color:var(--muted)]">{timeAt('CANCELLED')}</div>}
        </div>
      </div>
    );
  }

  const currentIdx = steps.indexOf(status);

  return (
    <ol className="relative">
      {steps.map((code, i) => {
        const done = currentIdx >= 0 && i < currentIdx;
        const current = i === currentIdx;
        const at = timeAt(code);
        const last = i === steps.length - 1;
        return (
          <li key={code} className="relative flex gap-3 pb-5 last:pb-0">
            {/* connector */}
            {!last && (
              <span
                className={`absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-0.5 ${
                  done ? 'bg-ember' : 'bg-[color:var(--line)]'
                }`}
              />
            )}
            {/* dot */}
            <span
              className={`z-[1] mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold ${
                done
                  ? 'border-ember bg-ember text-on-accent'
                  : current
                    ? 'border-ember bg-ember/15 text-ember'
                    : 'border-[color:var(--line)] text-[color:var(--muted)]'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <div
                className={`text-[14px] ${
                  current ? 'font-bold text-fg' : done ? 'font-semibold text-fg' : 'font-medium text-[color:var(--muted)]'
                }`}
              >
                {t(`st${code}`)}
                {current && <span className="ml-2 text-[11px] font-bold text-ember">•</span>}
              </div>
              {at && <div className="text-[12px] text-[color:var(--muted)]">{at}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
