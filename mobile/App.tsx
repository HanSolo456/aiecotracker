import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BottomTabs from './src/navigation/BottomTabs';
import ScanResultScreen from './src/screens/ScanResultScreen';
import GuideScreen from './src/screens/GuideScreen';
import PassportScreen from './src/screens/PassportScreen';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RootTabs" component={BottomTabs} />
      <Stack.Screen name="ScanResult" component={ScanResultScreen} />
      <Stack.Screen name="Guide" component={GuideScreen} />
      <Stack.Screen name="Passport" component={PassportScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
