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
        <div className="mb-7 text-center">
          <BrandMark className="text-[28px]" />
          <div className="mt-1 text-[13px] text-[color:var(--muted)]">{t('tag')}</div>
        </div>

        <div className="rounded-card border border-[color:var(--line)] bg-surface p-6 shadow-card">
          <PasswordReset />
        </div>

        <LangSwitch />
      </div>
    </div>
  );
}
