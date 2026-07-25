// Cook tab tree — mirrors the web cook area (orders / menu / reviews / profile).

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useI18n } from '../i18n/index.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import { placeholder } from '../screens/Placeholder.jsx';
import CookMenuStack from './CookMenuStack.jsx';
import CookProfileScreen from '../screens/cook/CookProfileScreen.jsx';
import { tabScreenOptions } from './tabOptions.js';

const Tab = createBottomTabNavigator();

export default function CookTabs() {
  const { t } = useI18n();
  const { colors } = useTheme();

  return (
    <Tab.Navigator screenOptions={tabScreenOptions(colors)}>
      <Tab.Screen
        name="CookOrders"
        component={placeholder(t('navCookOrders'), t('outOfPhase8'))}
        options={{ title: t('navCookOrders') }}
      />
      <Tab.Screen
        name="CookMenu"
        component={CookMenuStack}
        options={{ title: t('navCookMenu') }}
      />
      <Tab.Screen
        name="CookReviews"
        component={placeholder(t('navCookReviews'), t('outOfPhase8'))}
        options={{ title: t('navCookReviews') }}
      />
      <Tab.Screen
        name="CookProfile"
        component={CookProfileScreen}
        options={{ title: t('navProfile') }}
      />
    </Tab.Navigator>
  );
}
