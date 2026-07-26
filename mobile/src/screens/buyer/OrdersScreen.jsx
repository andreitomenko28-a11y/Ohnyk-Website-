// The buyer's order history. Live tracking on the map arrives in Module 8.6.

import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import { apiError } from '../../api/client.js';
import { fetchMyOrders } from '../../api/buyer.js';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

// Statuses during which there is a courier position worth showing.
const TRACKABLE = ['COURIER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'];

export default function OrdersScreen({ navigation }) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchMyOrders();
      setOrders(data.orders ?? []);
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

  return (
    <Screen title={t('navOrders')}>
      {error ? <Text style={[styles.error, { color: colors.ember }]}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={colors.ember} style={styles.loader} />
      ) : (
        <FlatList
          data={orders}
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
            <Text style={[styles.empty, { color: colors.muted }]}>{t('noOrdersYet')}</Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <View style={styles.head}>
                <Text style={[styles.cookName, { color: colors.fg }]}>{item.cook?.name ?? ''}</Text>
                <View style={[styles.pill, { backgroundColor: `${colors.ember}1f` }]}>
                  <Text style={[styles.pillText, { color: colors.ember }]}>
                    {t(`status_${item.status}`)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.meta, { color: colors.muted }]}>
                {new Date(item.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'uk-UA')}
                {`  ·  ${t(`delivery_${item.deliveryMethod}`)}`}
              </Text>
              {(item.items ?? []).map((i) => (
                <Text key={i.id} style={[styles.item, { color: colors.fg }]}>
                  {i.quantity}× {i.name}
                </Text>
              ))}
              <Text style={[styles.total, { color: colors.fg }]}>{item.total} ₴</Text>
              {TRACKABLE.includes(item.status) && item.deliveryMethod !== 'PICKUP' ? (
                <Pressable
                  onPress={() => navigation.navigate('Track', { orderId: item.id })}
                  style={[styles.track, { backgroundColor: colors.ember }]}
                >
                  <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 14 }}>
                    {t('trackOnMap')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  list: { paddingBottom: spacing.xxl },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: 14 },
  error: { fontSize: 13, marginBottom: spacing.md, fontWeight: '500' },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cookName: { fontSize: 15, fontWeight: '700' },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 3 },
  pillText: { fontSize: 11.5, fontWeight: '700' },
  meta: { fontSize: 12.5, marginTop: spacing.xs },
  item: { fontSize: 14, marginTop: spacing.sm },
  total: { fontSize: 17, fontWeight: '800', marginTop: spacing.md },
  track: { borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
});
