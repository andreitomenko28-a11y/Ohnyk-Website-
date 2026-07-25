// Courier tree. The web courier area is a single dashboard, but the app needs
// a second tab so the courier can reach their profile (and log out); the live
// map screen is pushed on top of the dashboard in Module 8.6.

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useI18n } from '../i18n/index.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import ProfileScreen from '../screens/ProfileScreen.jsx';
import CourierDashboardScreen from '../screens/courier/CourierDashboardScreen.jsx';
import { tabScreenOptions } from './tabOptions.js';

const Tab = createBottomTabNavigator();

export default function CourierTabs() {
  const { t } = useI18n();
  const { colors } = useTheme();

  return (
    <Tab.Navigator screenOptions={tabScreenOptions(colors)}>
      <Tab.Screen
        name="CourierDashboard"
        component={CourierDashboardScreen}
        options={{ title: t('navCourier') }}
      />
      <Tab.Screen
        name="CourierProfile"
        component={ProfileScreen}
        options={{ title: t('navProfile') }}
      />
    </Tab.Navigator>
  );
}
