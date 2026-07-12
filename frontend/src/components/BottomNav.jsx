import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useCart } from '../context/CartContext.jsx';

// Fixed bottom navigation, wired to routes with an active-state highlight.
export default function BottomNav() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { cart } = useCart();

  const items = [
    { icon: '🏠', label: t('navHome'), path: '/' },
    { icon: '🔍', label: t('navSearch'), path: '/discovery' },
    { icon: '🛒', label: t('navCart'), path: '/cart', badge: cart.itemCount },
    { icon: '👤', label: t('navProfile'), path: '/profile' },
  ];

  const isActive = (path) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <nav
      className="fixed bottom-0 left-1/2 flex w-full max-w-[420px] -translate-x-1/2 border-t border-[color:var(--line)] bg-white px-5 shadow-nav"
      style={{ paddingTop: '10px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          onClick={() => navigate(it.path)}
          className={`relative flex-1 text-center text-[10px] font-semibold ${
            isActive(it.path) ? 'text-ember' : 'text-[color:var(--muted)]'
          }`}
        >
          <span className="relative mb-0.5 block text-[19px]">
            {it.icon}
            {it.badge > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[9px] font-bold text-white">
                {it.badge}
              </span>
            )}
          </span>
          {it.label}
        </button>
      ))}
    </nav>
  );
}
