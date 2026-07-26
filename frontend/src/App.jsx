import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { I18nProvider } from './i18n/index.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import PasswordResetPage from './pages/PasswordResetPage.jsx';
import HomePage from './pages/HomePage.jsx';
import CookOnboarding from './pages/CookOnboarding.jsx';
import CookMenu from './pages/CookMenu.jsx';
import CookOrders from './pages/CookOrders.jsx';
import CookReviewsPage from './pages/CookReviews.jsx';
import CourierDashboard from './pages/CourierDashboard.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Discovery from './pages/Discovery.jsx';
import CookProfile from './pages/CookProfile.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import PaymentPage from './pages/PaymentPage.jsx';
import TrackPage from './pages/TrackPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import OrderDetailPage from './pages/OrderDetailPage.jsx';
import Profile from './pages/Profile.jsx';
import Addresses from './pages/Addresses.jsx';
import Favorites from './pages/Favorites.jsx';
import AdminAnalytics from './pages/AdminAnalytics.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminCooks from './pages/AdminCooks.jsx';
import AdminRefunds from './pages/AdminRefunds.jsx';

// Wraps a page in the auth guard + the responsive app shell (sidebar/bottom nav).
// Cooks are redirected to their own area — the customer shell isn't for them.
function Protected({ children }) {
  return (
    <ProtectedRoute>
      <CustomerOnly>
        <AppLayout>{children}</AppLayout>
      </CustomerOnly>
    </ProtectedRoute>
  );
}

function CustomerOnly({ children }) {
  const { user } = useAuth();
  if (user?.role === 'COOK') return <Navigate to="/cook" replace />;
  if (user?.role === 'COURIER') return <Navigate to="/courier" replace />;
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return children;
}

// Admin-only area (own shell).
function AdminProtected({ children }) {
  return (
    <ProtectedRoute>
      <AdminOnly>{children}</AdminOnly>
    </ProtectedRoute>
  );
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

// Cook-only area (own authenticated shell, no customer nav).
function CookProtected({ children }) {
  return (
    <ProtectedRoute>
      <CookOnly>{children}</CookOnly>
    </ProtectedRoute>
  );
}

function CookOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'COOK') return <Navigate to="/" replace />;
  return children;
}

// Courier-only area (own authenticated shell).
function CourierProtected({ children }) {
  return (
    <ProtectedRoute>
      <CourierOnly>{children}</CourierOnly>
    </ProtectedRoute>
  );
}

function CourierOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'COURIER') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <CartProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<AuthPage initialTab="login" />} />
                <Route path="/register" element={<AuthPage initialTab="register" />} />
                <Route path="/reset-password" element={<PasswordResetPage />} />

                <Route path="/cook" element={<CookProtected><CookOnboarding /></CookProtected>} />
                <Route path="/cook/menu" element={<CookProtected><CookMenu /></CookProtected>} />
                <Route path="/cook/orders" element={<CookProtected><CookOrders /></CookProtected>} />
                <Route path="/cook/reviews" element={<CookProtected><CookReviewsPage /></CookProtected>} />

                <Route path="/courier" element={<CourierProtected><CourierDashboard /></CourierProtected>} />

                <Route path="/admin" element={<Navigate to="/admin/analytics" replace />} />
                <Route path="/admin/analytics" element={<AdminProtected><AdminAnalytics /></AdminProtected>} />
                <Route path="/admin/users" element={<AdminProtected><AdminUsers /></AdminProtected>} />
                <Route path="/admin/cooks" element={<AdminProtected><AdminCooks /></AdminProtected>} />
                <Route path="/admin/refunds" element={<AdminProtected><AdminRefunds /></AdminProtected>} />

                <Route path="/" element={<Protected><HomePage /></Protected>} />
                <Route path="/discovery" element={<Protected><Discovery /></Protected>} />
                <Route path="/cooks/:id" element={<Protected><CookProfile /></Protected>} />
                <Route path="/cart" element={<Protected><Cart /></Protected>} />
                <Route path="/checkout" element={<Protected><Checkout /></Protected>} />
                <Route path="/pay/:orderId" element={<Protected><PaymentPage /></Protected>} />
                <Route path="/track/:orderId" element={<Protected><TrackPage /></Protected>} />
                <Route path="/orders" element={<Protected><OrdersPage /></Protected>} />
                <Route path="/orders/:id" element={<Protected><OrderDetailPage /></Protected>} />
                <Route path="/profile" element={<Protected><Profile /></Protected>} />
                <Route path="/addresses" element={<Protected><Addresses /></Protected>} />
                <Route path="/favorites" element={<Protected><Favorites /></Protected>} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
