// Reviews left on the cook, with reply / edit reply / delete reply.

import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Field from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import { apiError } from '../../api/client.js';
import { deleteReviewReply, fetchCookReviews, replyToReview } from '../../api/cook.js';
import { mediaUrl } from './CookProfileScreen.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

function Stars({ rating, color }) {
  return <Text style={{ color, fontSize: 14 }}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</Text>;
}

function ReviewCard({ review, onReply, onDeleteReply, colors, t }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.reply ?? '');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onReply(review.id, text.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.head}>
        <Text style={[styles.author, { color: colors.fg }]}>{review.author?.name ?? ''}</Text>
        <Stars rating={review.rating} color={colors.star} />
      </View>

      {review.comment ? (
        <Text style={[styles.comment, { color: colors.fg }]}>{review.comment}</Text>
      ) : null}

      {review.photos?.length ? (
        <View style={styles.photos}>
          {review.photos.map((url) => (
            <Image key={url} source={{ uri: mediaUrl(url) }} style={styles.photo} />
          ))}
        </View>
      ) : null}

      {review.reply && !editing ? (
        <View style={[styles.reply, { backgroundColor: colors.elevated }]}>
          <Text style={[styles.replyLabel, { color: colors.muted }]}>{t('yourReply')}</Text>
          <Text style={{ color: colors.fg, fontSize: 13.5 }}>{review.reply}</Text>
          <View style={styles.replyActions}>
            <Pressable onPress={() => { setText(review.reply); setEditing(true); }}>
              <Text style={{ color: colors.ember, fontSize: 12.5, fontWeight: '600' }}>{t('edit')}</Text>
            </Pressable>
            <Pressable onPress={() => onDeleteReply(review.id)}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: '600' }}>{t('delete')}</Text>
            </Pressable>
          </View>
        </View>
      ) : editing ? (
        <View style={styles.replyForm}>
          <Field value={text} onChangeText={setText} placeholder={t('replyPlaceholder')} multiline />
          <View style={styles.formActions}>
            <Button title={t('cancel')} variant="ghost" onPress={() => setEditing(false)} style={styles.flex} />
            <Button title={t('save')} onPress={submit} busy={busy} style={styles.flex} />
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setEditing(true)} style={styles.replyLink}>
          <Text style={{ color: colors.ember, fontSize: 13, fontWeight: '600' }}>{t('replyToReview')}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function CookReviewsScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();

  const [reviews, setReviews] = useState([]);
  const [average, setAverage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchCookReviews();
      setReviews(data.reviews ?? []);
      setAverage(data.average ?? 0);
      setTotal(data.total ?? 0);
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

  const replace = (updated) =>
    setReviews((list) => list.map((r) => (r.id === updated.id ? updated : r)));

  async function onReply(id, text) {
    try {
      replace(await replyToReview(id, text));
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function onDeleteReply(id) {
    try {
      // The endpoint answers 204 with no body, so clear the reply locally
      // rather than expecting an updated review back.
      await deleteReviewReply(id);
      setReviews((list) =>
        list.map((r) => (r.id === id ? { ...r, reply: null, repliedAt: null } : r)),
      );
    } catch (err) {
      setError(apiError(err));
    }
  }

  return (
    <Screen title={t('navCookReviews')}>
      {total > 0 ? (
        <Text style={[styles.summary, { color: colors.muted }]}>
          <Text style={{ color: colors.star }}>★ </Text>
          <Text style={{ color: colors.fg, fontWeight: '700' }}>{average}</Text>
          {`  ·  ${total} ${t('reviewsCount')}`}
        </Text>
      ) : null}

      {error ? <Text style={[styles.error, { color: colors.ember }]}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={colors.ember} style={styles.loader} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => r.id}
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
            <Text style={[styles.empty, { color: colors.muted }]}>{t('noReviewsYet')}</Text>
          }
          renderItem={({ item }) => (
            <ReviewCard
              review={item}
              colors={colors}
              t={t}
              onReply={onReply}
              onDeleteReply={onDeleteReply}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { fontSize: 14, marginBottom: spacing.md },
  loader: { marginTop: spacing.xl },
  list: { paddingBottom: spacing.xxl },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: 14 },
  error: { fontSize: 13, marginBottom: spacing.md, fontWeight: '500' },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  author: { fontSize: 14.5, fontWeight: '700' },
  comment: { fontSize: 14, marginTop: spacing.sm },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  photo: { width: 68, height: 68, borderRadius: radius.md },
  reply: { borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  replyLabel: { fontSize: 11.5, fontWeight: '700', marginBottom: 2 },
  replyActions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  replyForm: { marginTop: spacing.md },
  formActions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  replyLink: { marginTop: spacing.md },
});
