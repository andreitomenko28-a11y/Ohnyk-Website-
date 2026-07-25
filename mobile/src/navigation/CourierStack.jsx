// Courier tree. The web courier area is a single dashboard, so this is a stack
// rather than tabs; the live map screen is pushed on top in Module 8.6.

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useI18n } from '../i18n/index.jsx';
import { placeholder } from '../screens/Placeholder.jsx';

const Stack = createNativeStackNavigator();

export default function CourierStack() {
  const { t } = useI18n();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="CourierDashboard"
        component={placeholder(t('navCourier'), 'Доступні замовлення, GPS-трекінг — модулі 8.5 / 8.6')}
      />
    </Stack.Navigator>
  );
}
