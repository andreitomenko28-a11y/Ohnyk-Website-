import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { I18nProvider } from './i18n/index.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AuthPage from './pages/AuthPage.jsx';
import PasswordResetPage from './pages/PasswordResetPage.jsx';
import HomePage from './pages/HomePage.jsx';
import Discovery from './pages/Discovery.jsx';
import CookProfile from './pages/CookProfile.jsx';
import Cart from './pages/Cart.jsx';
import Profile from './pages/Profile.jsx';
import Addresses from './pages/Addresses.jsx';
import Favorites from './pages/Favorites.jsx';

// Wraps a page in the auth guard.
function Protected({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<AuthPage initialTab="login" />} />
              <Route path="/register" element={<AuthPage initialTab="register" />} />
              <Route path="/reset-password" element={<PasswordResetPage />} />

              <Route path="/" element={<Protected><HomePage /></Protected>} />
              <Route path="/discovery" element={<Protected><Discovery /></Protected>} />
              <Route path="/cooks/:id" element={<Protected><CookProfile /></Protected>} />
              <Route path="/cart" element={<Protected><Cart /></Protected>} />
              <Route path="/profile" element={<Protected><Profile /></Protected>} />
              <Route path="/addresses" element={<Protected><Addresses /></Protected>} />
              <Route path="/favorites" element={<Protected><Favorites /></Protected>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
