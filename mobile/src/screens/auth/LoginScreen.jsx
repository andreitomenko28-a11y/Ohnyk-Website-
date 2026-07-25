// Login. `identifier` accepts either an email or a phone number — the backend
// decides which by looking for '@', so a single field is correct here.

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Field from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiError } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { spacing } from '../../theme/tokens.js';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError('');
    setBusy(true);
    try {
      await login(identifier, password);
      // No navigation call: RootNavigator swaps trees once `user` is set.
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !busy;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.brand, { color: colors.ember }]}>Ohnyk</Text>
            <Text style={[styles.tag, { color: colors.muted }]}>{t('tag')}</Text>
          </View>

          <Field
            label={t('emailOrPhone')}
            placeholder="you@example.com"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
          />
          <Field
            label={t('password')}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />

          {error ? <Text style={[styles.error, { color: colors.ember }]}>{error}</Text> : null}

          <Button
            title={t('loginBtn')}
            onPress={onSubmit}
            busy={busy}
            style={!canSubmit && !busy ? styles.disabled : null}
          />

          <Pressable onPress={() => navigation.navigate('Register')} style={styles.switch}>
            <Text style={[styles.switchText, { color: colors.muted }]}>
              {t('noAccount')} <Text style={{ color: colors.ember }}>{t('tabRegister')}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: spacing.xxl },
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl },
  brand: { fontSize: 34, fontWeight: '800' },
  tag: { fontSize: 14, marginTop: spacing.xs },
  error: { fontSize: 13, marginBottom: spacing.md, fontWeight: '500' },
  disabled: { opacity: 0.5 },
  switch: { marginTop: spacing.lg, alignItems: 'center' },
  switchText: { fontSize: 13.5 },
});
