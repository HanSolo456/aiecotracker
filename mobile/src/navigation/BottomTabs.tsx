import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ScanScreen from '../screens/ScanScreen';
import SensorsScreen from '../screens/SensorsScreen';
import { View, Text, Platform } from 'react-native';
import { LayoutGrid, ScanLine, Cpu, BookOpen } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();

type TabIconProps = {
  routeName: string;
  focused: boolean;
};

function TabIcon({ routeName, focused }: TabIconProps) {
  let label = 'Dashboard';

  if (routeName === 'Scan') {
    label = 'Scan';
  } else if (routeName === 'Sensors') {
    label = 'Sensors';
  } else if (routeName === 'History') {
    label = 'Reports';
  }

  const inactiveColor = '#4b5563';
  const activeColor = '#39d353';

  return (
    <View
      style={{
        width: 80,
        height: 56,
        borderRadius: 20,
        backgroundColor: focused ? '#162e2a' : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {routeName === 'Dashboard' && (
        <LayoutGrid
          size={22}
          color={focused ? activeColor : inactiveColor}
          strokeWidth={focused ? 2.35 : 1.8}
        />
      )}
      {routeName === 'Scan' && (
        <ScanLine
          size={22}
          color={focused ? activeColor : inactiveColor}
          strokeWidth={focused ? 2.35 : 1.8}
        />
      )}
      {routeName === 'Sensors' && (
        <Cpu
          size={22}
          color={focused ? activeColor : inactiveColor}
          strokeWidth={focused ? 2.35 : 1.8}
        />
      )}
      {routeName === 'History' && (
        <BookOpen
          size={22}
          color={focused ? activeColor : inactiveColor}
          strokeWidth={focused ? 2.35 : 1.8}
        />
      )}

      <Text
        style={{
          marginTop: 4,
          fontSize: 11,
          fontWeight: '600',
          color: focused ? activeColor : inactiveColor,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function BottomTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 8;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: bottomInset,
          height: 74,
          borderRadius: 20,
          backgroundColor: '#11141b',
          borderTopWidth: 0,
          paddingHorizontal: 8,
          paddingBottom: 0,
          shadowColor: '#000',
          shadowOpacity: 0.28,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        },
        tabBarShowLabel: false,
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarIconStyle: {
          flex: 1,
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarIcon: ({ focused }) => (
          <TabIcon routeName={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Scan" component={ScanScreen} />
      <Tab.Screen name="Sensors" component={SensorsScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
    </Tab.Navigator>
  );
}

