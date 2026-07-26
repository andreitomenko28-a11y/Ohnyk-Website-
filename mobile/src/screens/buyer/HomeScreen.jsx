// Catalogue of cooks. Doubles as the search screen — the same list, filtered
// by a query when one is typed.
//
// Cached per query string, so going back to a term already typed shows its
// results instantly, and the catalogue still renders with no connection.

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Field from '../../components/Field.jsx';
import { apiError } from '../../api/client.js';
import { fetchCooks, searchCooks } from '../../api/buyer.js';
import { qk } from '../../offline/queryKeys.js';
import { mediaUrl } from '../cook/CookProfileScreen.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

function CookCard({ cook, onPress, colors, t }) {
  const avatar = mediaUrl(cook.avatar);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}
    >
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.elevated }]} />
      )}
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.fg }]} numberOfLines={1}>
            {cook.name}
          </Text>
          {cook.isVerified ? (
            <Text style={[styles.verified, { color: colors.ember }]}>✓</Text>
          ) : null}
        </View>
        {cook.bio ? (
          <Text style={[styles.bio, { color: colors.muted }]} numberOfLines={1}>
            {cook.bio}
          </Text>
        ) : null}
        <Text style={[styles.meta, { color: colors.muted }]}>
          <Text style={{ color: colors.star }}>★ </Text>
          {cook.rating || '—'}
          {cook.reviewCount ? ` (${cook.reviewCount})` : ''}
          {cook.priceFrom != null ? `  ·  ${t('priceFrom')} ${cook.priceFrom} ₴` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const { t } = useI18n();
  const { colors } = useTheme();

  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');

  // Debounce so typing doesn't fire a request — or a cache entry — per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setTerm(query.trim()), query ? 300 : 0);
    return () => clearTimeout(id);
  }, [query]);

  const { data, isLoading, isError, error, refetch, isRefetching, isPlaceholderData } = useQuery({
    queryKey: qk.cooks(term),
    queryFn: () => (term ? searchCooks(term) : fetchCooks({ limit: 50 })),
    // Keep the previous term's results on screen while the new ones load,
    // instead of flashing an empty list on every debounce tick.
    placeholderData: keepPreviousData,
  });

  const cooks = data?.cooks ?? [];

  return (
    <Screen title={t('popularCooks')}>
      <Field
        placeholder={t('searchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {isError ? <Text style={[styles.error, { color: colors.ember }]}>{apiError(error)}</Text> : null}

      {isLoading ? (
        <ActivityIndicator color={colors.ember} style={styles.loader} />
      ) : (
        <FlatList
          data={cooks}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              // The query's own fetch state, not a local flag: a refetch
              // while offline is paused and never settles, so a hand-rolled
              // flag would leave the spinner turning forever. The
              // placeholder check keeps a debounced search from flashing the
              // pull-to-refresh spinner while the buyer is still typing.
              refreshing={isRefetching && !isPlaceholderData}
              tintColor={colors.ember}
              onRefresh={refetch}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.muted }]}>{t('noCooksFound')}</Text>
          }
          renderItem={({ item }) => (
            <CookCard
              cook={item}
              colors={colors}
              t={t}
              onPress={() => navigation.navigate('Cook', { cookId: item.id, name: item.name })}
            />
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  body: { flex: 1, marginLeft: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { fontSize: 15.5, fontWeight: '700', flexShrink: 1 },
  verified: { fontSize: 13, fontWeight: '800' },
  bio: { fontSize: 13, marginTop: 1 },
  meta: { fontSize: 12.5, marginTop: spacing.xs },
});
