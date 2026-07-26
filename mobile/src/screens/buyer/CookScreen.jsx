// A cook's public page: menu with add-to-cart.
//
// The cart holds one cook at a time server-side, so adding a dish from a
// different cook replaces the cart — the API surfaces that as a 409, which is
// shown to the buyer rather than swallowed.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import { apiError } from '../../api/client.js';
import { addToCart, fetchCookMenu } from '../../api/buyer.js';
import { qk } from '../../offline/queryKeys.js';
import { mediaUrl } from '../cook/CookProfileScreen.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

function DishRow({ dish, onAdd, busy, colors, t }) {
  const image = mediaUrl(dish.image || dish.photos?.[0]?.url);

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      {image ? (
        <Image source={{ uri: image }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: colors.elevated }]} />
      )}
      <View style={styles.rowBody}>
        <Text style={[styles.dishName, { color: colors.fg }]} numberOfLines={1}>
          {dish.name}
        </Text>
        {dish.description ? (
          <Text style={[styles.dishDesc, { color: colors.muted }]} numberOfLines={2}>
            {dish.description}
          </Text>
        ) : null}
        <Text style={[styles.price, { color: colors.fg }]}>{dish.price} ₴</Text>
      </View>
      <Pressable
        onPress={() => onAdd(dish)}
        disabled={busy || !dish.isAvailable}
        style={[
          styles.add,
          { backgroundColor: dish.isAvailable ? colors.ember : colors.elevated },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.onAccent} size="small" />
        ) : (
          <Text style={{ color: dish.isAvailable ? colors.onAccent : colors.muted, fontSize: 18, fontWeight: '700' }}>
            +
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export default function CookScreen({ route, navigation }) {
  const { cookId, name } = route.params;
  const { t } = useI18n();
  const { colors } = useTheme();

  const queryClient = useQueryClient();
  const [added, setAdded] = useState(0);

  const { data: menu, isLoading, isError, error } = useQuery({
    queryKey: qk.cookMenu(cookId),
    queryFn: () => fetchCookMenu(cookId),
  });

  const addMutation = useMutation({
    mutationFn: (dish) => addToCart(dish.id, 1),
    onSuccess: (cart) => {
      setAdded((n) => n + 1);
      // The endpoint answers with the whole cart, so the Cart tab is already
      // correct by the time the buyer walks over to it.
      queryClient.setQueryData(qk.cart, cart);
    },
    // A 409 here means the cart already holds another cook's dishes; it is
    // rendered below rather than swallowed.
  });

  const dishes = menu?.dishes ?? menu?.menu?.flatMap((g) => g.dishes ?? []) ?? [];
  const message = addMutation.error ?? (isError ? error : null);

  return (
    <Screen title={name || menu?.cook?.name || ''}>
      {message ? (
        <Text style={[styles.error, { color: colors.ember }]}>{apiError(message)}</Text>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.ember} style={styles.loader} />
      ) : (
        <FlatList
          data={dishes}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.muted }]}>{t('noDishesYet')}</Text>
          }
          renderItem={({ item }) => (
            <DishRow
              dish={item}
              onAdd={addMutation.mutate}
              busy={addMutation.isPending && addMutation.variables?.id === item.id}
              colors={colors}
              t={t}
            />
          )}
        />
      )}

      {added > 0 ? (
        <Pressable
          onPress={() => navigation.navigate('Cart')}
          style={[styles.cartBar, { backgroundColor: colors.ember }]}
        >
          <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 15 }}>
            {t('goToCart')}
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  list: { paddingBottom: spacing.xxl * 2 },
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
  thumb: { width: 60, height: 60, borderRadius: radius.md },
  rowBody: { flex: 1, marginLeft: spacing.md },
  dishName: { fontSize: 15, fontWeight: '700' },
  dishDesc: { fontSize: 12.5, marginTop: 2 },
  price: { fontSize: 14.5, fontWeight: '700', marginTop: spacing.xs },
  add: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cartBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
});
