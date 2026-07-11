import { useI18n } from '../i18n/index.jsx';

// Fixed bottom navigation — Phase 1 only "Home" is active/wired.
export default function BottomNav() {
  const { t } = useI18n();
  const items = [
    { icon: '🏠', label: t('navHome'), active: true },
    { icon: '🔍', label: t('navSearch') },
    { icon: '🛒', label: t('navCart') },
    { icon: '👤', label: t('navProfile') },
  ];

  return (
    <nav
      className="fixed bottom-0 left-1/2 flex w-full max-w-[420px] -translate-x-1/2 border-t border-[color:var(--line)] bg-white px-5 shadow-nav"
      style={{ paddingTop: '10px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          className={`flex-1 text-center text-[10px] font-semibold ${
            it.active ? 'text-ember' : 'text-[color:var(--muted)]'
          }`}
        >
          <span className="mb-0.5 block text-[19px]">{it.icon}</span>
          {it.label}
        </button>
      ))}
    </nav>
  );
}
