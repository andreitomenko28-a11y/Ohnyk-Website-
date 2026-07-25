// Root navigation.
//
// Mirrors the web's route guards: an unauthenticated user only sees the auth
// stack, and each role gets its own tree (buyer tabs / cook tabs / courier).
// Switching on `user.role` here means no screen has to defend itself — the
// same shape as <Protected> / <CookProtected> / <CourierProtected> on web.

import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import AuthPlaceholder from '../screens/AuthPlaceholder.jsx';
import BuyerTabs from './BuyerTabs.jsx';
import CookTabs from './CookTabs.jsx';
import CourierStack from './CourierStack.jsx';

const Stack = createNativeStackNavigator();

function roleNavigator(role) {
  switch (role) {
    case 'COOK':
      return CookTabs;
    case 'COURIER':
      return CourierStack;
    default:
      return BuyerTabs; // CUSTOMER (and ADMIN, which is web-only for now)
  }
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const { colors, navTheme } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.ember} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="App" component={roleNavigator(user.role)} />
        ) : (
          <Stack.Screen name="Auth" component={AuthPlaceholder} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
