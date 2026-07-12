import { useTheme } from '../context/ThemeContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { SunIcon, MoonIcon } from './icons.jsx';

// Sun / moon toggle. `variant="segmented"` renders a labelled switch (Profile),
// otherwise a compact icon button for headers.
export default function ThemeToggle({ variant = 'icon', className = '' }) {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const isDark = theme === 'dark';

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex rounded-full border border-line bg-elevated p-1 ${className}`}
        role="group"
        aria-label="Theme"
      >
        <Segment active={!isDark} onClick={() => !isDark || toggle()}>
          <SunIcon className="h-4 w-4" /> <span className="ml-1.5">{t('themeLight')}</span>
        </Segment>
        <Segment active={isDark} onClick={() => isDark || toggle()}>
          <MoonIcon className="h-4 w-4" /> <span className="ml-1.5">{t('themeDark')}</span>
        </Segment>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Світла тема' : 'Темна тема'}
      title={isDark ? 'Світла тема' : 'Темна тема'}
      className={`flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full border border-line bg-surface text-fg transition-transform active:scale-90 ${className}`}
    >
      {isDark ? <SunIcon className="h-[18px] w-[18px]" /> : <MoonIcon className="h-[18px] w-[18px]" />}
    </button>
  );
}

function Segment({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        active ? 'text-on-accent' : 'text-[color:var(--muted)]'
      }`}
      style={active ? { background: 'linear-gradient(135deg, var(--ember), var(--ember-dark))' } : undefined}
    >
      {children}
    </button>
  );
}
