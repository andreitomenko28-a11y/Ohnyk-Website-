import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { FlameMark } from './Logo.jsx';

// Guards routes that require an authenticated user.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <FlameMark className="h-12 w-12 animate-pulse" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
