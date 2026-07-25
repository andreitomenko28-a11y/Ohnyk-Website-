// Shared bottom-tab styling, so buyer and cook tabs stay visually identical.
// Icons are text glyphs for now; the web's SVG icon set is ported in a later
// module once the real screens need them.

import { spacing } from '../theme/tokens.js';

export function tabScreenOptions(colors) {
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.ember,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.line,
      paddingTop: spacing.xs,
    },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
  };
}
