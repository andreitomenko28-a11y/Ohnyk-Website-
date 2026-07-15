import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { FlameMark } from './Logo.jsx';
import Wordmark from './Wordmark.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { LogoutIcon, CourierIcon } from './icons.jsx';

// Shell for the courier area: static top bar with brand + logout.
export default function CourierShell({ children }) {
  const { logout } = useAuth();
  const { t } = useI18n();

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
          <div className="flex items-center gap-2 pb-2.5 text-[14px] font-semibold text-fg">
            <CourierIcon className="h-4 w-4 text-ember" />
            {t('courierArea')}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">{children}</main>
    </div>
  );
}
