// Placeholder screen for the Module 8.1 navigation shell.
//
// Each of these is replaced by the real screen in its own module (8.2–8.8);
// the file disappears once the last one lands.

import { StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import { radius, spacing } from '../theme/tokens.js';

export default function Placeholder({ title, note }) {
  const { t } = useI18n();
  const { colors } = useTheme();

  return (
    <Screen title={title}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Text style={[styles.note, { color: colors.muted }]}>{note || t('comingSoon')}</Text>
      </View>
    </Screen>
  );
}

// Small helper so navigators can declare screens in one line.
export const placeholder = (title, note) => () => <Placeholder title={title} note={note} />;

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.xl,
    alignItems: 'center',
  },
  note: { fontSize: 14, textAlign: 'center' },
});
