// Cook tab tree — mirrors the web cook area (orders / menu / reviews / profile).

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useI18n } from '../i18n/index.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import { placeholder } from '../screens/Placeholder.jsx';
import { tabScreenOptions } from './tabOptions.js';

const Tab = createBottomTabNavigator();

export default function CookTabs() {
  const { t } = useI18n();
  const { colors } = useTheme();

  return (
    <Tab.Navigator screenOptions={tabScreenOptions(colors)}>
      <Tab.Screen
        name="CookOrders"
        component={placeholder(t('navCookOrders'), 'Вхідні замовлення та статуси — модуль 8.3')}
        options={{ title: t('navCookOrders') }}
      />
      <Tab.Screen
        name="CookMenu"
        component={placeholder(t('navCookMenu'), 'CRUD страв і фото — модуль 8.3')}
        options={{ title: t('navCookMenu') }}
      />
      <Tab.Screen
        name="CookReviews"
        component={placeholder(t('navCookReviews'), 'Відгуки та відповіді — модуль 8.3')}
        options={{ title: t('navCookReviews') }}
      />
      <Tab.Screen
        name="CookProfile"
        component={placeholder(t('navProfile'), 'Профіль кухаря і верифікація — модуль 8.3')}
        options={{ title: t('navProfile') }}
      />
    </Tab.Navigator>
  );
}
