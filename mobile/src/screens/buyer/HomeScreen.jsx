// Catalogue of cooks. Doubles as the search screen — the same list, filtered
// by a query when one is typed.

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Field from '../../components/Field.jsx';
import { apiError } from '../../api/client.js';
import { fetchCooks, searchCooks } from '../../api/buyer.js';
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
  const [cooks, setCooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (q) => {
    try {
      const data = q?.trim() ? await searchCooks(q.trim()) : await fetchCooks({ limit: 50 });
      setCooks(data.cooks ?? []);
      setError('');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => load(query), query ? 300 : 0);
    return () => clearTimeout(id);
  }, [query, load]);

  return (
    <Screen title={t('popularCooks')}>
      <Field
        placeholder={t('searchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {error ? <Text style={[styles.error, { color: colors.ember }]}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={colors.ember} style={styles.loader} />
      ) : (
        <FlatList
          data={cooks}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.ember}
              onRefresh={() => {
                setRefreshing(true);
                load(query).finally(() => setRefreshing(false));
              }}
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
