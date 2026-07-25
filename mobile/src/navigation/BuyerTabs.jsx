// Buyer tab tree — mirrors the web bottom navigation.
//
// Home and Cart are stacks because both lead deeper: Home → a cook's menu, and
// Cart → checkout → payment. Payment lives under the Cart stack so finishing a
// purchase returns to a sensible place.

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useI18n } from '../i18n/index.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import HomeScreen from '../screens/buyer/HomeScreen.jsx';
import CookScreen from '../screens/buyer/CookScreen.jsx';
import CartScreen from '../screens/buyer/CartScreen.jsx';
import CheckoutScreen from '../screens/buyer/CheckoutScreen.jsx';
import PaymentScreen from '../screens/buyer/PaymentScreen.jsx';
import OrdersScreen from '../screens/buyer/OrdersScreen.jsx';
import ProfileScreen from '../screens/ProfileScreen.jsx';
import { tabScreenOptions } from './tabOptions.js';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Catalogue" component={HomeScreen} />
      <Stack.Screen name="Cook" component={CookScreen} />
    </Stack.Navigator>
  );
}

function CartStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CartList" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
    </Stack.Navigator>
  );
}

export default function BuyerTabs() {
  const { t } = useI18n();
  const { colors } = useTheme();

  return (
    <Tab.Navigator screenOptions={tabScreenOptions(colors)}>
      <Tab.Screen name="Home" component={HomeStack} options={{ title: t('navHome') }} />
      <Tab.Screen name="Cart" component={CartStack} options={{ title: t('navCart') }} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: t('navOrders') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('navProfile') }} />
    </Tab.Navigator>
  );
}
