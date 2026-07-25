// Entry screen shown while no session exists.
//
// MODULE 8.1 SCOPE: real login/registration forms arrive in Module 8.2. Until
// then this screen carries dev buttons that fake a session per role, so the
// buyer / cook / courier navigators can be opened and reviewed now.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen.jsx';
import { ROLES, useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import { API_URL } from '../config/env.js';
import { radius, spacing } from '../theme/tokens.js';

const ROLE_LABEL = { CUSTOMER: 'Покупець', COOK: 'Кухар', COURIER: 'Курʼєр' };

export default function AuthPlaceholder() {
  const { devSignInAs } = useAuth();
  const { t } = useI18n();
  const { colors, toggleTheme } = useTheme();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.brand, { color: colors.ember }]}>Ohnyk</Text>
        <Text style={[styles.tag, { color: colors.muted }]}>{t('tag')}</Text>
      </View>

      <Text style={[styles.section, { color: colors.muted }]}>
        Модуль 8.1 — оболонка навігації. Форми входу зʼявляться у 8.2.
      </Text>

      {ROLES.map((role) => (
        <Pressable
          key={role}
          onPress={() => devSignInAs(role)}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.ember, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.onAccent }]}>
            Увійти як {ROLE_LABEL[role]}
          </Text>
        </Pressable>
      ))}

      <Pressable
        onPress={toggleTheme}
        style={[styles.ghost, { borderColor: colors.line }]}
      >
        <Text style={[styles.ghostText, { color: colors.fg }]}>Змінити тему</Text>
      </Pressable>

      <Text style={[styles.api, { color: colors.muted }]}>API: {API_URL}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl },
  brand: { fontSize: 34, fontWeight: '800' },
  tag: { fontSize: 14, marginTop: spacing.xs },
  section: { fontSize: 13, marginBottom: spacing.lg },
  button: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonText: { fontSize: 15, fontWeight: '700' },
  ghost: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  ghostText: { fontSize: 14, fontWeight: '600' },
  api: { fontSize: 11, marginTop: spacing.xl, textAlign: 'center' },
});
