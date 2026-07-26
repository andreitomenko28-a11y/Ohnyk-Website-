// "You are offline" strip.
//
// It lives inside Screen rather than in each screen: connectivity is not a
// property of any one list, and a screen that forgot to render it would leave
// the user reading day-old prices with no hint that they are stale.

import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n/index.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import { useOnlineStatus } from '../offline/online.js';
import { radius, spacing } from '../theme/tokens.js';

export default function OfflineBanner() {
  const online = useOnlineStatus();
  const { t } = useI18n();
  const { colors } = useTheme();

  if (online) return null;

  return (
    <View style={[styles.bar, { backgroundColor: colors.elevated, borderColor: colors.line }]}>
      <Text style={[styles.text, { color: colors.muted }]} numberOfLines={2}>
        {t('offlineNotice')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  text: { fontSize: 12.5, fontWeight: '500' },
});
