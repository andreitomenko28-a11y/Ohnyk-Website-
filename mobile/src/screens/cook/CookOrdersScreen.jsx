// Incoming orders for the cook, with the one forward action each order allows.
//
// The action shown comes from api/orderStatus.js, which mirrors the server's
// transition table — offering a button the server would reject is worse than
// offering none.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import { apiError } from '../../api/client.js';
import { advanceOrderStatus, fetchCookOrders } from '../../api/cook.js';
import { canCancel, isActive, nextCookStatus } from '../../api/orderStatus.js';
import { qk } from '../../offline/queryKeys.js';
import useRefreshOnFocus from '../../offline/useRefreshOnFocus.js';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

const FILTERS = ['active', 'all'];

function OrderCard({ order, onAdvance, onCancel, busy, colors, t }) {
  const next = nextCookStatus(order);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.cardHead}>
        <Text style={[styles.orderNo, { color: colors.fg }]}>#{order.id.slice(0, 8)}</Text>
        <View style={[styles.statusPill, { backgroundColor: `${colors.ember}1f` }]}>
          <Text style={[styles.statusText, { color: colors.ember }]}>{t(`status_${order.status}`)}</Text>
        </View>
      </View>

      <Text style={[styles.meta, { color: colors.muted }]}>
        {t(`delivery_${order.deliveryMethod}`)}
        {order.buyer?.name ? ` · ${order.buyer.name}` : ''}
      </Text>

      {(order.items ?? []).map((item) => (
        <Text key={item.id} style={[styles.item, { color: colors.fg }]}>
          {item.quantity}× {item.name}
          <Text style={{ color: colors.muted }}> · {item.lineTotal} ₴</Text>
        </Text>
      ))}

      {order.note ? (
        <Text style={[styles.note, { color: colors.muted }]}>{order.note}</Text>
      ) : null}

      <View style={[styles.totals, { borderTopColor: colors.line }]}>
        <Text style={[styles.meta, { color: colors.muted }]}>{t('cookPayout')}</Text>
        <Text style={[styles.payout, { color: colors.fg }]}>{order.cookPayout} ₴</Text>
      </View>

      {next ? (
        <Button title={t(`action_${next}`)} onPress={() => onAdvance(order, next)} busy={busy} />
      ) : null}
      {canCancel(order) ? (
        <Pressable onPress={() => onCancel(order)} style={styles.cancelLink}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{t('cancelOrder')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function CookOrdersScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();

  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('active');

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: qk.cookOrders,
    queryFn: () => fetchCookOrders(),
  });
  useRefreshOnFocus(refetch);

  const advanceMutation = useMutation({
    mutationFn: ({ order, status }) => advanceOrderStatus(order.id, status),
    // The response is the updated order, so the one row is swapped in place —
    // refetching the whole list would scroll-jump for a single status change.
    onSuccess: (updated) =>
      queryClient.setQueryData(qk.cookOrders, (previous) => ({
        ...previous,
        orders: (previous?.orders ?? []).map((o) => (o.id === updated.id ? updated : o)),
      })),
  });

  const apply = (order, status) => advanceMutation.mutate({ order, status });

  function confirmCancel(order) {
    Alert.alert(t('cancelOrderTitle'), `#${order.id.slice(0, 8)}`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('cancelOrder'), style: 'destructive', onPress: () => apply(order, 'CANCELLED') },
    ]);
  }

  const orders = data?.orders ?? [];
  const visible = filter === 'active' ? orders.filter(isActive) : orders;
  const message = advanceMutation.error ?? (isError ? error : null);

  return (
    <Screen title={t('navCookOrders')}>
      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                {
                  borderColor: active ? colors.ember : colors.line,
                  backgroundColor: active ? `${colors.ember}14` : 'transparent',
                },
              ]}
            >
              <Text style={{ color: active ? colors.ember : colors.muted, fontSize: 13 }}>
                {t(f === 'active' ? 'ordersActive' : 'ordersAll')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {message ? (
        <Text style={[styles.error, { color: colors.ember }]}>{apiError(message)}</Text>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.ember} style={styles.loader} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              // The query's own fetch state, not a local flag: a refetch
              // while offline is paused and never settles, so a hand-rolled
              // flag would leave the spinner turning forever.
              refreshing={isRefetching}
              tintColor={colors.ember}
              onRefresh={refetch}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.muted }]}>{t('noOrdersYet')}</Text>
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              colors={colors}
              t={t}
              busy={advanceMutation.isPending && advanceMutation.variables?.order?.id === item.id}
              onAdvance={apply}
              onCancel={confirmCancel}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  filterChip: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  loader: { marginTop: spacing.xl },
  list: { paddingBottom: spacing.xxl },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: 14 },
  error: { fontSize: 13, marginBottom: spacing.md, fontWeight: '500' },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNo: { fontSize: 15, fontWeight: '700' },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 3 },
  statusText: { fontSize: 11.5, fontWeight: '700' },
  meta: { fontSize: 12.5, marginTop: spacing.xs },
  item: { fontSize: 14, marginTop: spacing.sm },
  note: { fontSize: 12.5, marginTop: spacing.sm, fontStyle: 'italic' },
  totals: { borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.md, marginBottom: spacing.md },
  payout: { fontSize: 17, fontWeight: '800' },
  cancelLink: { alignItems: 'center', paddingVertical: spacing.md },
});
