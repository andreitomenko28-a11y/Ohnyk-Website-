// Live tracking for the buyer: the courier's position on a map, plus the
// order's status.
//
// Reachable only while the order is actually being delivered — before that
// there is no courier to show, and after delivery the position is stale.

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import TrackingMap from '../../components/TrackingMap.jsx';
import Button from '../../components/Button.jsx';
import { apiError } from '../../api/client.js';
import { fetchOrder } from '../../api/buyer.js';
import useOrderTracking from '../../realtime/useOrderTracking.js';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

// Minutes since a position was reported — a stale marker should say so rather
// than imply the courier is standing still.
function minutesAgo(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export default function TrackScreen({ route, navigation }) {
  const { orderId } = route.params;
  const { t } = useI18n();
  const { colors } = useTheme();

  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const { location, status, state } = useOrderTracking(orderId);

  useEffect(() => {
    fetchOrder(orderId)
      .then(setOrder)
      .catch((err) => setError(apiError(err)));
  }, [orderId]);

  const courier = location ? { latitude: location.lat, longitude: location.lng } : null;
  const destination =
    order?.deliveryLat != null && order?.deliveryLng != null
      ? { latitude: order.deliveryLat, longitude: order.deliveryLng }
      : null;

  const currentStatus = status ?? order?.status;
  const age = minutesAgo(location?.updatedAt);

  if (error) {
    return (
      <Screen title={t('trackTitle')}>
        <Text style={[styles.error, { color: colors.ember }]}>{error}</Text>
        <Button title={t('toOrders')} variant="ghost" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen title={t('trackTitle')}>
      <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Text style={[styles.status, { color: colors.fg }]}>
          {currentStatus ? t(`status_${currentStatus}`) : t('loading')}
        </Text>
        {order?.courier?.name ? (
          <Text style={[styles.meta, { color: colors.muted }]}>
            {order.courier.name}
            {order.courier.transport ? ` · ${t(`transport${order.courier.transport}`)}` : ''}
          </Text>
        ) : null}
      </View>

      <TrackingMap courier={courier} destination={destination} style={styles.map} />

      <View style={styles.footer}>
        {state === 'forbidden' ? (
          <Text style={[styles.hint, { color: colors.ember }]}>{t('trackForbidden')}</Text>
        ) : !courier ? (
          <View style={styles.waiting}>
            <ActivityIndicator color={colors.ember} size="small" />
            <Text style={[styles.hint, { color: colors.muted, marginLeft: spacing.sm }]}>
              {t('waitingForCourier')}
            </Text>
          </View>
        ) : (
          <Text style={[styles.hint, { color: colors.muted }]}>
            {age != null && age > 1 ? `${t('lastSeen')} ${age} ${t('minutesAgo')}` : t('trackingLive')}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusCard: { borderWidth: 1, borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.md },
  status: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: spacing.xs },
  map: { flex: 1, borderRadius: radius.card },
  footer: { paddingVertical: spacing.md, alignItems: 'center' },
  waiting: { flexDirection: 'row', alignItems: 'center' },
  hint: { fontSize: 13, textAlign: 'center' },
  error: { fontSize: 13, marginBottom: spacing.md, fontWeight: '500' },
});
