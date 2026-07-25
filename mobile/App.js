// Ohnyk mobile — app root.
//
// Provider order matters: safe-area and theme wrap everything (navigation
// chrome reads the palette), i18n sits above navigation (tab labels are
// translated), and auth is innermost of the providers but outside the
// navigator, since the navigator picks a tree based on the session.

import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from './src/theme/ThemeContext.jsx';
import { I18nProvider } from './src/i18n/index.jsx';
import { AuthProvider } from './src/auth/AuthContext.jsx';
import RootNavigator from './src/navigation/RootNavigator.jsx';

// Status-bar style has to follow the theme, so it reads the context here
// rather than being hard-coded in App.
function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <ThemedStatusBar />
            <RootNavigator />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
