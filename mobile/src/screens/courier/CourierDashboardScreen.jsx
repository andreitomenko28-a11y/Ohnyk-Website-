// Courier dashboard: go online, claim an order, advance the delivery, and
// share location while a delivery is active.
//
// Location tracking follows the delivery rather than a toggle: it starts when
// an order is active and stops the moment none is, so the courier is never
// tracked when there is nothing to track.

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import { apiError } from '../../api/client.js';
import {
  activeDelivery,
  advanceDelivery,
  claimOrder,
  fetchAvailableOrders,
  fetchCourierProfile,
  fetchMyDeliveries,
  nextDeliveryStatus,
} from '../../api/courier.js';
import {
  isTracking,
  requestTrackingPermissions,
  startTracking,
  stopTracking,
} from '../../tracking/locationTask.js';
import { setCourierStatus } from '../../api/courier.js';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

export default function CourierDashboardScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();

  const [courier, setCourier] = useState(null);
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState([]);
  const [tracking, setTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const active = activeDelivery(mine);

  const load = useCallback(async () => {
    try {
      const [profile, avail, deliveries] = await Promise.all([
        fetchCourierProfile(),
        fetchAvailableOrders().catch(() => []),
        fetchMyDeliveries(),
      ]);
      setCourier(profile);
      setAvailable(avail);
      setMine(deliveries);
      setTracking(await isTracking());
      setError('');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Keep tracking in step with whether a delivery is actually in progress.
  useEffect(() => {
    if (loading) return;
    (async () => {
      if (!active && (await isTracking())) {
        await stopTracking();
        setTracking(false);
      }
    })();
  }, [active, loading]);

  async function toggleOnline(value) {
    try {
      setCourier(await setCourierStatus({ status: value ? 'ONLINE' : 'OFFLINE' }));
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function onClaim(order) {
    setBusyId(order.id);
    setError('');
    try {
      await claimOrder(order.id);
      await load();
    } catch (err) {
      // 409 means another courier got there first — a normal race, not a fault.
      setError(apiError(err));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function onAdvance(order) {
    const next = nextDeliveryStatus(order);
    if (!next) return;
    setBusyId(order.id);
    setError('');
    try {
      const updated = await advanceDelivery(order.id, next);
      setMine((list) => list.map((o) => (o.id === updated.id ? updated : o)));
      if (updated.status === 'DELIVERED') {
        await stopTracking();
        setTracking(false);
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onStartTracking() {
    const { granted, background } = await requestTrackingPermissions();
    if (!granted) {
      Alert.alert(t('permissionNeededTitle'), t('permissionLocation'));
      return;
    }
    try {
      await startTracking(active.id);
      setTracking(true);
      // Foreground-only permission still works while the app is open — worth
      // saying so plainly rather than letting the courier assume otherwise.
      if (!background) Alert.alert(t('locationForegroundOnlyTitle'), t('locationForegroundOnly'));
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function onStopTracking() {
    await stopTracking();
    setTracking(false);
  }

  if (loading) {
    return (
      <Screen title={t('navCourier')}>
        <ActivityIndicator color={colors.ember} style={styles.loader} />
      </Screen>
    );
  }

  return (
    <Screen title={t('navCourier')}>
      <View style={[styles.statusRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View>
          <Text style={[styles.statusLabel, { color: colors.fg }]}>
            {courier?.status === 'ONLINE' ? t('courierOnline') : t('courierOffline')}
          </Text>
          <Text style={[styles.statusHint, { color: colors.muted }]}>{t('courierOnlineHint')}</Text>
        </View>
        <Switch
          value={courier?.status === 'ONLINE'}
          onValueChange={toggleOnline}
          trackColor={{ true: colors.ember }}
        />
      </View>

      {error ? <Text style={[styles.error, { color: colors.ember }]}>{error}</Text> : null}

      {active ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.ember }]}>
          <Text style={[styles.cardTitle, { color: colors.fg }]}>{t('activeDelivery')}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {active.cook?.name ? `${active.cook.name} → ` : ''}
            {active.addressText ?? ''}
          </Text>
          <Text style={[styles.statusPill, { color: colors.ember }]}>{t(`status_${active.status}`)}</Text>

          <View style={styles.trackRow}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {tracking ? t('trackingOn') : t('trackingOff')}
            </Text>
            <Button
              title={tracking ? t('stopTracking') : t('startTracking')}
              variant={tracking ? 'ghost' : 'primary'}
              onPress={tracking ? onStopTracking : onStartTracking}
              style={styles.trackBtn}
            />
          </View>

          <Button
            title={t(`action_${nextDeliveryStatus(active)}`)}
            onPress={() => onAdvance(active)}
            busy={busyId === active.id}
          />
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.fg }]}>{t('availableOrders')}</Text>
      <FlatList
        data={available}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
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
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.muted }]}>
            {courier?.status === 'ONLINE' ? t('noAvailableOrders') : t('goOnlineToSee')}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.cardTitle, { color: colors.fg }]}>{item.cook?.name ?? ''}</Text>
            <Text style={[styles.meta, { color: colors.muted }]}>{item.addressText ?? ''}</Text>
            <Text style={[styles.total, { color: colors.fg }]}>{item.total} ₴</Text>
            <Pressable
              onPress={() => onClaim(item)}
              disabled={busyId === item.id || !!active}
              style={[
                styles.claim,
                { backgroundColor: active ? colors.elevated : colors.ember },
              ]}
            >
              <Text style={{ color: active ? colors.muted : colors.onAccent, fontWeight: '700', fontSize: 14 }}>
                {active ? t('finishCurrentFirst') : t('claimOrder')}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  statusLabel: { fontSize: 15, fontWeight: '700' },
  statusHint: { fontSize: 12, marginTop: 2 },
  error: { fontSize: 13, marginBottom: spacing.md, fontWeight: '500' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  empty: { textAlign: 'center', marginTop: spacing.xl, fontSize: 13.5 },
  card: { borderWidth: 1.5, borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.md },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: spacing.xs },
  statusPill: { fontSize: 12, fontWeight: '700', marginTop: spacing.sm },
  total: { fontSize: 17, fontWeight: '800', marginTop: spacing.sm, marginBottom: spacing.md },
  claim: { borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' },
  trackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.md },
  trackBtn: { flex: 0, paddingHorizontal: spacing.lg, minWidth: 150 },
});
