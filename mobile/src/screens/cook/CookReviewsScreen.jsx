// Reviews left on the cook, with reply / edit reply / delete reply.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Field from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import { apiError } from '../../api/client.js';
import { deleteReviewReply, fetchCookReviews, replyToReview } from '../../api/cook.js';
import { mediaUrl } from './CookProfileScreen.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { qk } from '../../offline/queryKeys.js';
import useRefreshOnFocus from '../../offline/useRefreshOnFocus.js';
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
    } catch {
      // The screen renders the failure; keep the draft open so the cook can
      // retry without retyping it.
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

  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: qk.cookReviews,
    queryFn: () => fetchCookReviews(),
  });
  useRefreshOnFocus(refetch);

  // Rewrites one review inside the cached page, leaving `average` and `total`
  // as the server reported them — a reply changes neither.
  const patchReview = (id, patch) =>
    queryClient.setQueryData(qk.cookReviews, (previous) => ({
      ...previous,
      reviews: (previous?.reviews ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));

  const replyMutation = useMutation({
    mutationFn: ({ id, text }) => replyToReview(id, text),
    onSuccess: (updated) => patchReview(updated.id, updated),
  });

  const deleteReplyMutation = useMutation({
    mutationFn: (id) => deleteReviewReply(id),
    // The endpoint answers 204 with no body, so the reply is cleared locally
    // rather than read back off a response that has none.
    onSuccess: (_data, id) => patchReview(id, { reply: null, repliedAt: null }),
  });

  const onReply = (id, text) => replyMutation.mutateAsync({ id, text });
  const onDeleteReply = (id) => deleteReplyMutation.mutate(id);

  const reviews = data?.reviews ?? [];
  const average = data?.average ?? 0;
  const total = data?.total ?? 0;
  const message = replyMutation.error ?? deleteReplyMutation.error ?? (isError ? error : null);

  return (
    <Screen title={t('navCookReviews')}>
      {total > 0 ? (
        <Text style={[styles.summary, { color: colors.muted }]}>
          <Text style={{ color: colors.star }}>★ </Text>
          <Text style={{ color: colors.fg, fontWeight: '700' }}>{average}</Text>
          {`  ·  ${total} ${t('reviewsCount')}`}
        </Text>
      ) : null}

      {message ? (
        <Text style={[styles.error, { color: colors.ember }]}>{apiError(message)}</Text>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.ember} style={styles.loader} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => r.id}
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
