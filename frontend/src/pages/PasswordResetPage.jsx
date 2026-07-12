import { useI18n } from '../i18n/index.jsx';
import BrandMark from '../components/BrandMark.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import PasswordReset from '../components/PasswordReset.jsx';

// Public page wrapper for the password-reset flow.
export default function PasswordResetPage() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark stacked markClassName="h-16 w-16" className="text-[32px]" />
          <div className="mt-3 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ember">
            <span className="h-px w-6 bg-ember/50" />
            {t('tag')}
            <span className="h-px w-6 bg-ember/50" />
          </div>
        </div>

        <div className="rounded-card border border-[color:var(--line)] bg-surface p-6 shadow-card">
          <PasswordReset />
        </div>

        <LangSwitch />
      </div>
    </div>
  );
}
