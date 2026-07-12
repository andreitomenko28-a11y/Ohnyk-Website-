import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useCart } from '../context/CartContext.jsx';
import { HomeIcon, SearchIcon, CartIcon, ProfileIcon } from './icons.jsx';

// Fixed bottom navigation — floating pill with outline icons (active = ember).
export default function BottomNav() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { cart } = useCart();

  const items = [
    { Icon: HomeIcon, label: t('navHome'), path: '/' },
    { Icon: SearchIcon, label: t('navSearch'), path: '/discovery' },
    { Icon: CartIcon, label: t('navCart'), path: '/cart', badge: cart.itemCount },
    { Icon: ProfileIcon, label: t('navProfile'), path: '/profile' },
  ];

  const isActive = (path) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[420px] -translate-x-1/2 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2">
      <nav className="flex items-center justify-around rounded-[22px] border border-line bg-surface px-3 py-2.5 shadow-nav">
        {items.map(({ Icon, label, path, badge }) => {
          const active = isActive(path);
          return (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={`relative flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold transition-colors ${
                active ? 'text-ember' : 'text-[color:var(--muted)]'
              }`}
            >
              <span className="relative">
                <Icon className="h-[22px] w-[22px]" />
                {badge > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[9px] font-bold text-on-accent">
                    {badge}
                  </span>
                )}
              </span>
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
