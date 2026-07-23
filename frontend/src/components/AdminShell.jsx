import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { FlameMark } from './Logo.jsx';
import Wordmark from './Wordmark.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { LogoutIcon } from './icons.jsx';

// Shell for the admin area: top bar with brand, section nav, theme + logout.
export default function AdminShell({ children }) {
  const { logout } = useAuth();
  const { t } = useI18n();

  const tabs = [
    { to: '/admin/analytics', label: t('adminAnalytics') },
    { to: '/admin/users', label: t('adminUsers') },
    { to: '/admin/cooks', label: t('adminCooks') },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-[color:var(--line)] bg-surface">
        <div className="mx-auto max-w-5xl px-5">
          <div className="flex items-center justify-between py-3.5">
            <span className="inline-flex items-center gap-2 text-[20px]">
              <FlameMark className="h-7 w-7" />
              <Wordmark />
              <span className="ml-1 rounded-md bg-ember/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ember">
                {t('adminArea')}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--line)] px-3 py-2 text-[13px] font-semibold text-[color:var(--muted)] transition-colors hover:text-fg"
              >
                <LogoutIcon className="h-4 w-4" />
                {t('logout')}
              </button>
            </div>
          </div>
          <nav className="flex gap-1 pb-1">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `rounded-t-lg px-4 py-2.5 text-[14px] font-semibold transition-colors ${
                    isActive ? 'border-b-2 border-ember text-fg' : 'text-[color:var(--muted)] hover:text-fg'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-6">{children}</main>
    </div>
  );
}
