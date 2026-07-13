import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { FlameMark } from './Logo.jsx';
import Wordmark from './Wordmark.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { LogoutIcon, ProfileIcon, FoodIcon } from './icons.jsx';

// Shared shell for the cook area: static top bar (no sticky overlap) + tab nav.
export default function CookShell({ children }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const verified = user?.cook?.verificationStatus === 'VERIFIED';

  const tabClass = ({ isActive }) =>
    `inline-flex items-center gap-2 border-b-2 px-1 pb-2.5 pt-1 text-[14px] font-semibold transition-colors ${
      isActive ? 'border-ember text-fg' : 'border-transparent text-[color:var(--muted)] hover:text-fg'
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[color:var(--line)] bg-surface">
        <div className="mx-auto max-w-3xl px-5">
          <div className="flex items-center justify-between py-3.5">
            <span className="inline-flex items-center gap-2 text-[20px]">
              <FlameMark className="h-7 w-7" />
              <Wordmark />
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
          {/* Tabs */}
          <nav className="flex gap-6">
            <NavLink to="/cook" end className={tabClass}>
              <ProfileIcon className="h-4 w-4" />
              {t('tabProfile')}
            </NavLink>
            <NavLink to="/cook/menu" className={tabClass}>
              <FoodIcon className="h-4 w-4" />
              {t('tabMenu')}
              {!verified && <span className="ml-1 text-[11px]">🔒</span>}
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">{children}</main>
    </div>
  );
}
