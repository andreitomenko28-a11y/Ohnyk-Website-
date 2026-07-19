import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import BrandMark from './BrandMark.jsx';
import LangSwitch from './LangSwitch.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import NotificationBell from './NotificationBell.jsx';
import { HomeIcon, SearchIcon, CartIcon, ProfileIcon, HeartIcon, BoxIcon } from './icons.jsx';

// Desktop navigation rail (visible at lg+). Mobile uses BottomNav instead.
export default function Sidebar() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { cart } = useCart();
  const { user } = useAuth();

  const items = [
    { Icon: HomeIcon, label: t('navHome'), path: '/' },
    { Icon: SearchIcon, label: t('navSearch'), path: '/discovery' },
    { Icon: HeartIcon, label: t('favorites'), path: '/favorites' },
    { Icon: CartIcon, label: t('navCart'), path: '/cart', badge: cart.itemCount },
    { Icon: BoxIcon, label: t('navOrders'), path: '/orders' },
    { Icon: ProfileIcon, label: t('navProfile'), path: '/profile' },
  ];

  const isActive = (path) => (path === '/' ? pathname === '/' : pathname.startsWith(path));
  const initial = (user?.fullName || '?').trim().charAt(0).toUpperCase();

  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] flex-none flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
      <button onClick={() => navigate('/')} className="mb-8 px-2 text-left">
        <BrandMark className="text-[26px]" markClassName="h-8 w-8" />
      </button>

      <nav className="flex flex-col gap-1">
        {items.map(({ Icon, label, path, badge }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                active ? 'bg-elevated text-ember' : 'text-[color:var(--muted)] hover:bg-elevated hover:text-fg'
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

      <div className="mt-auto space-y-4">
        <button
          onClick={() => navigate('/profile')}
          className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left"
        >
          <span
            className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-full font-display text-sm font-bold text-on-accent"
            style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember))' }}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{user?.fullName}</span>
            <span className="block truncate text-xs text-[color:var(--muted)]">{user?.email}</span>
          </span>
        </button>

        <div className="flex items-center justify-between px-1">
          <LangSwitch className="!mt-0" />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  );
}
