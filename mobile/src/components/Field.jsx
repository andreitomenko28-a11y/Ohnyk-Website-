// Labelled text input, themed. Mirrors the web's .field-label/.field-input pair.

import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext.jsx';
import { radius, spacing } from '../theme/tokens.js';

export default function Field({ label, hint, style, ...inputProps }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={[styles.label, { color: colors.muted }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        {...inputProps}
        style={[
          styles.input,
          { backgroundColor: colors.elevated, borderColor: colors.line, color: colors.fg },
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontSize: 12, fontWeight: '600', marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  hint: { fontSize: 11, marginTop: spacing.xs },
});
