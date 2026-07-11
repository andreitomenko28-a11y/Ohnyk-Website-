import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';

// Guards routes that require an authenticated user.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[color:var(--muted)]">
        {t('loading')}
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
