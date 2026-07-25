// Profile — session summary, theme switch and logout.
//
// Shared by all three role trees: it closes the session lifecycle that Module
// 8.2 introduces (login → autologin → logout). Editing profile details and
// addresses arrives with the buyer/cook modules.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen.jsx';
import Button from '../components/Button.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import { radius, spacing } from '../theme/tokens.js';

const ROLE_KEY = { CUSTOMER: 'roleBuyer', COOK: 'roleCook', COURIER: 'roleCourier' };

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { colors, mode, toggleTheme } = useTheme();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t('navProfile')}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Text style={[styles.name, { color: colors.fg }]}>{user?.fullName}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{user?.email}</Text>
        {user?.phone ? <Text style={[styles.meta, { color: colors.muted }]}>{user.phone}</Text> : null}
        <View style={[styles.badge, { backgroundColor: `${colors.ember}1f` }]}>
          <Text style={[styles.badgeText, { color: colors.ember }]}>
            {t(ROLE_KEY[user?.role] ?? 'roleBuyer')}
          </Text>
        </View>
      </View>

      <Button
        title={mode === 'dark' ? t('themeLight') : t('themeDark')}
        variant="ghost"
        onPress={toggleTheme}
        style={styles.action}
      />
      <Button
        title={lang === 'uk' ? 'English' : 'Українська'}
        variant="ghost"
        onPress={() => setLang(lang === 'uk' ? 'en' : 'uk')}
        style={styles.action}
      />
      <Button title={t('logout')} onPress={onLogout} busy={busy} style={styles.action} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  name: { fontSize: 18, fontWeight: '700' },
  meta: { fontSize: 13.5, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.md,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  action: { marginBottom: spacing.md },
});
