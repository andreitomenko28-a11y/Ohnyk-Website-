// Primary / ghost button with a busy state, themed.

import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext.jsx';
import { radius, spacing } from '../theme/tokens.js';

export default function Button({ title, onPress, busy = false, variant = 'primary', style }) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        isPrimary
          ? { backgroundColor: colors.ember }
          : { borderWidth: 1.5, borderColor: colors.line },
        (pressed || busy) && styles.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={isPrimary ? colors.onAccent : colors.fg} />
      ) : (
        <Text style={[styles.label, { color: isPrimary ? colors.onAccent : colors.fg }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  pressed: { opacity: 0.85 },
  label: { fontSize: 15, fontWeight: '700' },
});
