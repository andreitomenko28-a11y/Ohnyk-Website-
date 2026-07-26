// Cart: quantity stepper per line, plus the pricing breakdown the server
// computes (subtotal, service fee, total) — the app never recalculates money.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import { apiError } from '../../api/client.js';
import { clearCart, fetchCart, setCartItemQuantity } from '../../api/buyer.js';
import { qk } from '../../offline/queryKeys.js';
import useRefreshOnFocus from '../../offline/useRefreshOnFocus.js';
import { mediaUrl } from '../cook/CookProfileScreen.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

function Stepper({ quantity, onChange, busy, colors }) {
  return (
    <View style={[styles.stepper, { borderColor: colors.line }]}>
      <Pressable onPress={() => onChange(quantity - 1)} disabled={busy} hitSlop={6} style={styles.stepBtn}>
        <Text style={{ color: colors.fg, fontSize: 18 }}>−</Text>
      </Pressable>
      <Text style={{ color: colors.fg, fontSize: 14, fontWeight: '700', minWidth: 22, textAlign: 'center' }}>
        {quantity}
      </Text>
      <Pressable onPress={() => onChange(quantity + 1)} disabled={busy} hitSlop={6} style={styles.stepBtn}>
        <Text style={{ color: colors.fg, fontSize: 18 }}>+</Text>
      </Pressable>
    </View>
  );
}

export default function CartScreen({ navigation }) {
  const { t } = useI18n();
  const { colors } = useTheme();

  const queryClient = useQueryClient();
  const { data: cart, isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.cart,
    queryFn: fetchCart,
  });
  useRefreshOnFocus(refetch);

  // Both writes answer with the whole cart, so the cache is replaced outright
  // rather than invalidated — no second round-trip for a body we already have.
  const writeCart = (updated) => queryClient.setQueryData(qk.cart, updated);

  const quantityMutation = useMutation({
    // Quantity 0 is how the server removes a line.
    mutationFn: ({ item, quantity }) => setCartItemQuantity(item.id, Math.max(0, quantity)),
    onSuccess: writeCart,
  });

  const clearMutation = useMutation({ mutationFn: clearCart, onSuccess: writeCart });

  function changeQuantity(item, quantity) {
    if (quantity > 99) return;
    quantityMutation.mutate({ item, quantity });
  }

  const items = cart?.items ?? [];
  // Any of the three can be the reason the screen is out of date.
  const message = quantityMutation.error ?? clearMutation.error ?? (isError ? error : null);

  if (isLoading) {
    return (
      <Screen title={t('navCart')}>
        <ActivityIndicator color={colors.ember} style={styles.loader} />
      </Screen>
    );
  }

  return (
    <Screen title={t('navCart')}>
      {message ? (
        <Text style={[styles.error, { color: colors.ember }]}>{apiError(message)}</Text>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.muted }]}>{t('cartEmpty')}</Text>
        }
        renderItem={({ item }) => {
          const image = mediaUrl(item.dish.image);
          return (
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              {image ? (
                <Image source={{ uri: image }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { backgroundColor: colors.elevated }]} />
              )}
              <View style={styles.rowBody}>
                <Text style={[styles.dishName, { color: colors.fg }]} numberOfLines={1}>
                  {item.dish.name}
                </Text>
                <Text style={[styles.lineTotal, { color: colors.muted }]}>{item.lineTotal} ₴</Text>
              </View>
              <Stepper
                quantity={item.quantity}
                busy={quantityMutation.isPending && quantityMutation.variables?.item?.id === item.id}
                colors={colors}
                onChange={(q) => changeQuantity(item, q)}
              />
            </View>
          );
        }}
      />

      {items.length > 0 ? (
        <View style={[styles.summary, { borderTopColor: colors.line }]}>
          <Row label={t('subtotal')} value={`${cart.subtotal} ₴`} colors={colors} />
          {cart.serviceFee ? (
            <Row label={t('serviceFee')} value={`${cart.serviceFee} ₴`} colors={colors} />
          ) : null}
          <Row label={t('total')} value={`${cart.total} ₴`} colors={colors} strong />

          <Button title={t('checkout')} onPress={() => navigation.navigate('Checkout')} />
          <Pressable
            onPress={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
            style={styles.clear}
          >
            <Text style={{ color: colors.muted, fontSize: 13 }}>{t('clearCart')}</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, colors, strong }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={{ color: strong ? colors.fg : colors.muted, fontSize: strong ? 15 : 13.5, fontWeight: strong ? '700' : '400' }}>
        {label}
      </Text>
      <Text style={{ color: colors.fg, fontSize: strong ? 18 : 14, fontWeight: strong ? '800' : '600' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  list: { paddingBottom: spacing.md },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: 14 },
  error: { fontSize: 13, marginBottom: spacing.md, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  thumb: { width: 52, height: 52, borderRadius: radius.md },
  rowBody: { flex: 1, marginLeft: spacing.md },
  dishName: { fontSize: 14.5, fontWeight: '700' },
  lineTotal: { fontSize: 13, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm },
  stepBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  summary: { borderTopWidth: 1, paddingTop: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  clear: { alignItems: 'center', paddingVertical: spacing.md },
});
