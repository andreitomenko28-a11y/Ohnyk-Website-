// Ohnyk mobile — app root.
//
// Provider order matters: safe-area and theme wrap everything (navigation
// chrome reads the palette), i18n sits above navigation (tab labels are
// translated), and auth is innermost of the providers but outside the
// navigator, since the navigator picks a tree based on the session.
//
// The query cache wraps auth, because autologin and every screen below it read
// through the same client, and PersistQueryClientProvider has to be mounted
// before the first query runs so restored data is already in place.

import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { ThemeProvider, useTheme } from './src/theme/ThemeContext.jsx';
import { I18nProvider } from './src/i18n/index.jsx';
import { AuthProvider } from './src/auth/AuthContext.jsx';
import RootNavigator from './src/navigation/RootNavigator.jsx';
import { persistOptions, queryClient } from './src/offline/queryClient.js';
import { startOnlineBridge } from './src/offline/online.js';

// Status-bar style has to follow the theme, so it reads the context here
// rather than being hard-coded in App.
function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  // Teach React Query what "online" means on a phone — see offline/online.js.
  useEffect(() => startOnlineBridge(), []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
            <AuthProvider>
              <ThemedStatusBar />
              <RootNavigator />
            </AuthProvider>
          </PersistQueryClientProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
