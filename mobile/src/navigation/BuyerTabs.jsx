// Buyer tab tree — mirrors the web bottom navigation
// (Home / Search / Cart / Orders / Profile).

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useI18n } from '../i18n/index.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import { placeholder } from '../screens/Placeholder.jsx';
import ProfileScreen from '../screens/ProfileScreen.jsx';
import { tabScreenOptions } from './tabOptions.js';

const Tab = createBottomTabNavigator();

export default function BuyerTabs() {
  const { t } = useI18n();
  const { colors } = useTheme();

  return (
    <Tab.Navigator screenOptions={tabScreenOptions(colors)}>
      <Tab.Screen
        name="Home"
        component={placeholder(t('navHome'), 'Каталог кухарів — модуль 8.4')}
        options={{ title: t('navHome') }}
      />
      <Tab.Screen
        name="Search"
        component={placeholder(t('navSearch'), 'Пошук і фільтри — модуль 8.4')}
        options={{ title: t('navSearch') }}
      />
      <Tab.Screen
        name="Cart"
        component={placeholder(t('navCart'), 'Кошик і checkout — модуль 8.4')}
        options={{ title: t('navCart') }}
      />
      <Tab.Screen
        name="Orders"
        component={placeholder(t('navOrders'), 'Історія замовлень і трекінг — модулі 8.4 / 8.6')}
        options={{ title: t('navOrders') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('navProfile') }}
      />
    </Tab.Navigator>
  );
}
