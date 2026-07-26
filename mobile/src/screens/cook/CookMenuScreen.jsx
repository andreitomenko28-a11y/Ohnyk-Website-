// Cook menu: the dish list, with add / edit / delete.
//
// Editing opens DishFormScreen; this screen owns the list and reloads on focus
// so a change made there is reflected on the way back.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import { apiError } from '../../api/client.js';
import { deleteDish, fetchMyDishes } from '../../api/cook.js';
import { qk } from '../../offline/queryKeys.js';
import useRefreshOnFocus from '../../offline/useRefreshOnFocus.js';
import { mediaUrl } from './CookProfileScreen.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

function DishRow({ dish, onPress, onDelete, colors, t }) {
  const cover = mediaUrl(dish.image || dish.photos?.[0]?.url);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: colors.elevated }]} />
      )}
      <View style={styles.rowBody}>
        <Text style={[styles.dishName, { color: colors.fg }]} numberOfLines={1}>
          {dish.name}
        </Text>
        <Text style={[styles.dishMeta, { color: colors.muted }]}>
          {dish.price} ₴{dish.category ? ` · ${dish.category.name}` : ''}
        </Text>
        {!dish.isAvailable ? (
          <Text style={[styles.unavailable, { color: colors.muted }]}>{t('dishUnavailable')}</Text>
        ) : null}
      </View>
      <Pressable onPress={onDelete} hitSlop={10} style={styles.delete}>
        <Text style={{ color: colors.ember, fontSize: 13, fontWeight: '600' }}>{t('delete')}</Text>
      </Pressable>
    </Pressable>
  );
}

export default function CookMenuScreen({ navigation }) {
  const { t } = useI18n();
  const { colors } = useTheme();

  const queryClient = useQueryClient();
  const { data: dishes = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: qk.myDishes,
    queryFn: fetchMyDishes,
  });
  // Refresh on focus, e.g. on the way back from the dish form.
  useRefreshOnFocus(refetch);

  const deleteMutation = useMutation({
    mutationFn: (dish) => deleteDish(dish.id),
    // The endpoint returns no body, so the row is dropped from the cached list
    // instead of refetching it.
    onSuccess: (_data, dish) =>
      queryClient.setQueryData(qk.myDishes, (list = []) => list.filter((d) => d.id !== dish.id)),
  });

  function confirmDelete(dish) {
    Alert.alert(t('deleteDishTitle'), dish.name, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => deleteMutation.mutate(dish) },
    ]);
  }

  const message = deleteMutation.error ?? (isError ? error : null);

  return (
    <Screen title={t('navCookMenu')}>
      <Button title={t('addDish')} onPress={() => navigation.navigate('DishForm', {})} />

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
              colors={colors}
              t={t}
              onPress={() => navigation.navigate('DishForm', { dish: item })}
              onDelete={() => confirmDelete(item)}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  list: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: 14 },
  error: { fontSize: 13, marginTop: spacing.md, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  thumb: { width: 54, height: 54, borderRadius: radius.md },
  rowBody: { flex: 1, marginLeft: spacing.md },
  dishName: { fontSize: 15, fontWeight: '700' },
  dishMeta: { fontSize: 13, marginTop: 2 },
  unavailable: { fontSize: 11.5, marginTop: 2 },
  delete: { paddingHorizontal: spacing.sm },
});
