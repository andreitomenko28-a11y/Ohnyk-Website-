// Registration. Mirrors the web form: pick a role, then only that role's
// extra fields are shown — and only those are sent (the server schema is
// strict, see auth/registerPayload.js).

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Field from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiError } from '../../api/client.js';
import { buildRegisterPayload, ROLES, TRANSPORTS } from '../../auth/registerPayload.js';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

const ROLE_KEY = { CUSTOMER: 'roleBuyer', COOK: 'roleCook', COURIER: 'roleCourier' };
const ROLE_SUB_KEY = { CUSTOMER: 'roleBuyerSub', COOK: 'roleCookSub', COURIER: 'roleCourierSub' };

const EMPTY = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  kitchenAddress: '',
  deliveryZone: '',
  bio: '',
  transport: 'BICYCLE',
};

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();

  const [role, setRole] = useState('CUSTOMER');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit() {
    setError('');
    setBusy(true);
    try {
      await register(buildRegisterPayload(form, role));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: colors.fg }]}>{t('tabRegister')}</Text>

          <Text style={[styles.label, { color: colors.muted }]}>{t('roleLabel')}</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => {
              const active = role === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRole(r)}
                  style={[
                    styles.roleCard,
                    {
                      borderColor: active ? colors.ember : colors.line,
                      backgroundColor: active ? `${colors.ember}14` : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.roleName, { color: active ? colors.ember : colors.fg }]}>
                    {t(ROLE_KEY[r])}
                  </Text>
                  <Text style={[styles.roleSub, { color: colors.muted }]}>{t(ROLE_SUB_KEY[r])}</Text>
                </Pressable>
              );
            })}
          </View>

          <Field label={t('name')} placeholder="Андрій" value={form.fullName} onChangeText={set('fullName')} />
          <Field
            label={t('email')}
            placeholder="you@example.com"
            value={form.email}
            onChangeText={set('email')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <Field
            label={t('phone')}
            placeholder="+380"
            value={form.phone}
            onChangeText={set('phone')}
            keyboardType="phone-pad"
          />
          <Field
            label={t('password')}
            placeholder="••••••••"
            hint={t('pwHint')}
            value={form.password}
            onChangeText={set('password')}
            secureTextEntry
          />

          {role === 'COOK' && (
            <>
              <Field
                label={t('kitchenAddressLabel')}
                placeholder={t('cookKitchenPlaceholder')}
                value={form.kitchenAddress}
                onChangeText={set('kitchenAddress')}
              />
              <Field
                label={t('deliveryZoneLabel')}
                placeholder={t('cookDeliveryPlaceholder')}
                value={form.deliveryZone}
                onChangeText={set('deliveryZone')}
              />
              <Field label={t('bio')} value={form.bio} onChangeText={set('bio')} multiline />
            </>
          )}

          {role === 'COURIER' && (
            <>
              <Text style={[styles.label, { color: colors.muted }]}>{t('transportLabel')}</Text>
              <View style={styles.transportRow}>
                {TRANSPORTS.map((tr) => {
                  const active = form.transport === tr;
                  return (
                    <Pressable
                      key={tr}
                      onPress={() => set('transport')(tr)}
                      style={[
                        styles.chip,
                        {
                          borderColor: active ? colors.ember : colors.line,
                          backgroundColor: active ? `${colors.ember}14` : 'transparent',
                        },
                      ]}
                    >
                      <Text style={{ color: active ? colors.ember : colors.muted, fontSize: 13 }}>
                        {t(`transport${tr}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {error ? <Text style={[styles.error, { color: colors.ember }]}>{error}</Text> : null}

          <Button title={t('registerBtn')} onPress={onSubmit} busy={busy} />

          <Text style={[styles.terms, { color: colors.muted }]}>{t('terms')}</Text>

          <Pressable onPress={() => navigation.goBack()} style={styles.switch}>
            <Text style={[styles.switchText, { color: colors.muted }]}>
              {t('haveAccount')} <Text style={{ color: colors.ember }}>{t('tabLogin')}</Text>
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
  title: { fontSize: 26, fontWeight: '800', marginTop: spacing.lg, marginBottom: spacing.lg },
  label: { fontSize: 12, fontWeight: '600', marginBottom: spacing.sm },
  roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  roleCard: { flex: 1, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md },
  roleName: { fontSize: 14, fontWeight: '700' },
  roleSub: { fontSize: 11, marginTop: 2 },
  transportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  error: { fontSize: 13, marginBottom: spacing.md, fontWeight: '500' },
  terms: { fontSize: 11, textAlign: 'center', marginTop: spacing.md },
  switch: { marginTop: spacing.lg, alignItems: 'center' },
  switchText: { fontSize: 13.5 },
});
