// Safe-area screen wrapper. Every screen sits inside one so content clears the
// notch and the home indicator without repeating the same padding everywhere.

import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext.jsx';
import OfflineBanner from './OfflineBanner.jsx';
import { spacing } from '../theme/tokens.js';

export default function Screen({ children, title, edges = ['top'] }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: edges.includes('top') ? insets.top : 0,
          paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        },
      ]}
    >
      {title ? <Text style={[styles.title, { color: colors.fg }]}>{title}</Text> : null}
      <OfflineBanner />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.md },
});
