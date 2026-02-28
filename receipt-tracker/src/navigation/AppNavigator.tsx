import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import CaptureScreen from '../screens/CaptureScreen';
import AddReceiptScreen from '../screens/AddReceiptScreen';
import ReceiptDetailScreen from '../screens/ReceiptDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  AddReceipt: { imageUri: string };
  ReceiptDetail: { receiptId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Capture: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'receipt';
          if (route.name === 'Home') iconName = 'receipt-outline';
          else if (route.name === 'Capture') iconName = 'camera-outline';
          else if (route.name === 'Settings') iconName = 'settings-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Receipts' }} />
      <Tab.Screen name="Capture" component={CaptureScreen} options={{ title: 'Capture' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="AddReceipt"
          component={AddReceiptScreen}
          options={{ title: 'Add Receipt', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="ReceiptDetail"
          component={ReceiptDetailScreen}
          options={{ title: 'Receipt', headerBackTitle: 'Back' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
