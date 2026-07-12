import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import BottomNav from '../components/BottomNav.jsx';
import ProfileForm from '../components/ProfileForm.jsx';
import LangSwitch from '../components/LangSwitch.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function Profile() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [editing, setEditing] = useState(false);

  const initial = (user?.fullName || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[420px] bg-canvas pb-24">
      <header className="px-5 pb-3 pt-5">
        <div className="font-display text-xl font-bold">{t('profileTitle')}</div>
      </header>

      <div className="px-5">
        <div className="flex items-center gap-4 rounded-card border border-[color:var(--line)] bg-surface p-4 shadow-card">
          <div
            className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full font-display text-2xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--glow), var(--ember))' }}
          >
            {user.avatar ? (
              <img src={user.avatar} alt={user.fullName} className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold">{user.fullName}</div>
            <div className="truncate text-sm text-[color:var(--muted)]">{user.email}</div>
            <div className="mt-1 inline-block rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold text-ember-dark">
              {user.role === 'COOK' ? `👩‍🍳 ${t('roleCook')}` : `🛒 ${t('roleBuyer')}`}
            </div>
          </div>
        </div>

        {editing ? (
          <div className="mt-4 rounded-card border border-[color:var(--line)] bg-surface p-5 shadow-card">
            <ProfileForm onDone={() => setEditing(false)} />
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            <MenuRow icon="✏️" label={t('editProfile')} onClick={() => setEditing(true)} />
            <MenuRow icon="❤️" label={t('favorites')} onClick={() => navigate('/favorites')} />
            <MenuRow icon="📍" label={t('myAddresses')} onClick={() => navigate('/addresses')} />
            <MenuRow icon="🚪" label={t('logout')} onClick={logout} danger />
          </div>
        )}

        {/* Appearance — theme switch */}
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-3 text-sm font-semibold">
            <span className="text-lg">🎨</span> {t('appearance')}
          </span>
          <ThemeToggle variant="segmented" />
        </div>

        <LangSwitch />
      </div>

      <BottomNav />
    </div>
  );
}

function MenuRow({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-surface px-4 py-3.5 text-left"
    >
      <span className="text-lg">{icon}</span>
      <span className={`text-sm font-semibold ${danger ? 'text-ember-dark' : 'text-fg'}`}>
        {label}
      </span>
      <span className="ml-auto text-[color:var(--muted)]">›</span>
    </button>
  );
}
