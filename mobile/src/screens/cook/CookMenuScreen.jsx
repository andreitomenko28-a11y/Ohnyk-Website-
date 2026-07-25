// Cook menu: the dish list, with add / edit / delete.
//
// Editing opens DishFormScreen; this screen owns the list and reloads on focus
// so a change made there is reflected on the way back.

import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import { apiError } from '../../api/client.js';
import { deleteDish, fetchMyDishes } from '../../api/cook.js';
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

  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setDishes(await fetchMyDishes());
      setError('');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever the screen regains focus (e.g. returning from the form).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirmDelete(dish) {
    Alert.alert(t('deleteDishTitle'), dish.name, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDish(dish.id);
            setDishes((list) => list.filter((d) => d.id !== dish.id));
          } catch (err) {
            setError(apiError(err));
          }
        },
      },
    ]);
  }

  return (
    <Screen title={t('navCookMenu')}>
      <Button title={t('addDish')} onPress={() => navigation.navigate('DishForm', {})} />

      {error ? <Text style={[styles.error, { color: colors.ember }]}>{error}</Text> : null}

      {loading ? (
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
