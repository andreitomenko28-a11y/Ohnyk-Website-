// Cook profile: verification status, editable details, avatar upload.
//
// Replaces the shared ProfileScreen in the cook tab. Account-level actions
// (logout, theme, language) stay reachable at the bottom so the cook doesn't
// lose them by having a role-specific profile.

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Field from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import PhotoPickerSheet from '../../components/PhotoPickerSheet.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiError } from '../../api/client.js';
import { buildCookProfilePatch, fetchCookProfile, updateCookProfile, uploadCookPhoto } from '../../api/cook.js';
import { API_ORIGIN } from '../../config/env.js';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

const STATUS_KEY = { PENDING: 'statusPending', VERIFIED: 'statusVerified', REJECTED: 'statusRejected' };

// Uploaded media comes back as a server-relative path.
export function mediaUrl(path) {
  if (!path) return null;
  return /^https?:\/\//i.test(path) ? path : `${API_ORIGIN}${path}`;
}

const emptyForm = { displayName: '', bio: '', kitchenAddress: '', deliveryZone: '', city: '' };

export default function CookProfileScreen() {
  const { logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { colors, mode, toggleTheme } = useTheme();

  const [cook, setCook] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchCookProfile();
      setCook(data);
      setForm({
        displayName: data.displayName ?? '',
        bio: data.bio ?? '',
        kitchenAddress: data.kitchenAddress ?? '',
        deliveryZone: data.deliveryZone ?? '',
        city: data.city ?? '',
      });
      setError('');
    } catch (err) {
      setError(apiError(err));
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  async function onSave() {
    const patch = buildCookProfilePatch(form, cook);
    if (Object.keys(patch).length === 0) return; // server rejects an empty patch
    setSaving(true);
    setError('');
    try {
      const updated = await updateCookProfile(patch);
      setCook(updated);
      setSaved(true);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function onPicked(assets) {
    setUploading(true);
    setError('');
    try {
      setCook(await uploadCookPhoto(assets[0]));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.ember} style={styles.loader} />
      </Screen>
    );
  }

  const avatar = mediaUrl(cook?.avatar);
  const status = cook?.verificationStatus;

  return (
    <Screen title={t('navProfile')}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.ember}
            onRefresh={() => {
              setRefreshing(true);
              load().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        <View style={styles.avatarRow}>
          <Pressable onPress={() => setPickerOpen(true)} disabled={uploading}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={[styles.avatar, { borderColor: colors.line }]} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty, { borderColor: colors.line, backgroundColor: colors.elevated }]}>
                {uploading ? (
                  <ActivityIndicator color={colors.ember} />
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{t('addPhoto')}</Text>
                )}
              </View>
            )}
          </Pressable>
          <View style={styles.avatarMeta}>
            <Text style={[styles.name, { color: colors.fg }]}>
              {cook?.displayName || cook?.user?.fullName || ''}
            </Text>
            {status ? (
              <View style={[styles.badge, { backgroundColor: `${colors.ember}1f` }]}>
                <Text style={[styles.badgeText, { color: colors.ember }]}>{t(STATUS_KEY[status])}</Text>
              </View>
            ) : null}
            {cook?.canOperate === false ? (
              <Text style={[styles.hint, { color: colors.muted }]}>{t('cookNotOperating')}</Text>
            ) : null}
          </View>
        </View>

        <Field label={t('displayName')} value={form.displayName} onChangeText={set('displayName')} />
        <Field label={t('bio')} value={form.bio} onChangeText={set('bio')} multiline />
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
        <Field label={t('cityLabel')} value={form.city} onChangeText={set('city')} />

        {error ? <Text style={[styles.error, { color: colors.ember }]}>{error}</Text> : null}
        {saved ? <Text style={[styles.saved, { color: colors.muted }]}>{t('savedNotice')}</Text> : null}

        <Button title={t('save')} onPress={onSave} busy={saving} />

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

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
        <Button title={t('logout')} onPress={logout} style={styles.action} />
      </ScrollView>

      <PhotoPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onPicked={onPicked} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  content: { paddingBottom: spacing.xxl },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 1 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  avatarMeta: { marginLeft: spacing.lg, flex: 1 },
  name: { fontSize: 18, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 3, marginTop: spacing.sm },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
  hint: { fontSize: 12, marginTop: spacing.sm },
  error: { fontSize: 13, marginBottom: spacing.md, fontWeight: '500' },
  saved: { fontSize: 12.5, marginBottom: spacing.md },
  divider: { height: 1, marginVertical: spacing.xl },
  action: { marginBottom: spacing.md },
});
