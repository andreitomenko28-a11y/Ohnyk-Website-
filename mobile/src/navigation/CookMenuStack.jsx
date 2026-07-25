// Menu tab: list → dish form. A stack rather than a bare screen so the form
// pushes over the list and returns to it.

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CookMenuScreen from '../screens/cook/CookMenuScreen.jsx';
import DishFormScreen from '../screens/cook/DishFormScreen.jsx';

const Stack = createNativeStackNavigator();

export default function CookMenuStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MenuList" component={CookMenuScreen} />
      <Stack.Screen name="DishForm" component={DishFormScreen} />
    </Stack.Navigator>
  );
}
