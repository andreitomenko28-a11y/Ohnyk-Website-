// Courier dashboard: go online, claim an order, advance the delivery, and
// share location while a delivery is active.
//
// Location tracking follows the delivery rather than a toggle: it starts when
// an order is active and stops the moment none is, so the courier is never
// tracked when there is nothing to track.

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { qk } from '../../offline/queryKeys.js';
import useRefreshOnFocus from '../../offline/useRefreshOnFocus.js';
import { radius, spacing } from '../../theme/tokens.js';

export default function CourierDashboardScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();

  const queryClient = useQueryClient();
  const [tracking, setTracking] = useState(false);
  // Permission and task failures are local to this screen, not to a request.
  const [trackingError, setTrackingError] = useState('');

  const profileQuery = useQuery({ queryKey: qk.courierProfile, queryFn: fetchCourierProfile });
  const availableQuery = useQuery({
    queryKey: qk.courierAvailable,
    // The board is closed to an offline courier; an empty list says that
    // better than an error banner, and the hint below already explains why.
    queryFn: () => fetchAvailableOrders().catch(() => []),
  });
  const deliveriesQuery = useQuery({
    queryKey: qk.courierDeliveries,
    queryFn: () => fetchMyDeliveries(),
  });

  const courier = profileQuery.data ?? null;
  const available = availableQuery.data ?? [];
  const mine = deliveriesQuery.data ?? [];
  const active = activeDelivery(mine);
  const loading = profileQuery.isLoading || deliveriesQuery.isLoading;

  // One refresh for the whole board — the three lists are read together.
  const reload = useCallback(
    () =>
      Promise.all([profileQuery.refetch(), availableQuery.refetch(), deliveriesQuery.refetch()]),
    [profileQuery.refetch, availableQuery.refetch, deliveriesQuery.refetch],
  );
  useRefreshOnFocus(reload);

  const statusMutation = useMutation({
    mutationFn: (value) => setCourierStatus({ status: value ? 'ONLINE' : 'OFFLINE' }),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.courierProfile, updated);
      // Going online is what makes the board non-empty.
      queryClient.invalidateQueries({ queryKey: qk.courierAvailable });
    },
  });

  const claimMutation = useMutation({
    mutationFn: (order) => claimOrder(order.id),
    // Settled, not success: a 409 means another courier won the race, and the
    // board is just as stale then as it is after a win.
    onSettled: () => reload(),
  });

  const advanceMutation = useMutation({
    mutationFn: ({ order, status }) => advanceDelivery(order.id, status),
    onSuccess: (updated) =>
      queryClient.setQueryData(qk.courierDeliveries, (list = []) =>
        list.map((o) => (o.id === updated.id ? updated : o)),
      ),
  });

  const busyId = claimMutation.isPending
    ? claimMutation.variables?.id
    : advanceMutation.isPending
      ? advanceMutation.variables?.order?.id
      : null;

  const error =
    statusMutation.error ??
    claimMutation.error ??
    advanceMutation.error ??
    profileQuery.error ??
    deliveriesQuery.error ??
    null;

  // Keep tracking in step with whether a delivery is actually in progress.
  // Whether the background task runs is OS state, not server state, so it is
  // read from the task manager rather than cached alongside the queries.
  useEffect(() => {
    if (loading) return;
    (async () => {
      const running = await isTracking().catch(() => false);
      if (!active && running) {
        await stopTracking();
        setTracking(false);
        return;
      }
      setTracking(running);
    })();
  }, [active, loading]);

  function onAdvance(order) {
    const next = nextDeliveryStatus(order);
    if (!next) return;
    advanceMutation.mutate({ order, status: next }, {
      onSuccess: async (updated) => {
        if (updated.status === 'DELIVERED') {
          await stopTracking();
          setTracking(false);
        }
      },
    });
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
      setTrackingError('');
      // Foreground-only permission still works while the app is open — worth
      // saying so plainly rather than letting the courier assume otherwise.
      if (!background) Alert.alert(t('locationForegroundOnlyTitle'), t('locationForegroundOnly'));
    } catch (err) {
      setTrackingError(apiError(err));
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
          onValueChange={statusMutation.mutate}
          disabled={statusMutation.isPending}
          trackColor={{ true: colors.ember }}
        />
      </View>

      {error || trackingError ? (
        <Text style={[styles.error, { color: colors.ember }]}>
          {error ? apiError(error) : trackingError}
        </Text>
      ) : null}

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
            refreshing={
              profileQuery.isRefetching ||
              availableQuery.isRefetching ||
              deliveriesQuery.isRefetching
            }
            tintColor={colors.ember}
            onRefresh={reload}
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
              onPress={() => claimMutation.mutate(item)}
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
