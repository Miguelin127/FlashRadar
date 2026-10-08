import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RadarScreen from '../screens/RadarScreen';
import DealDetailScreen from '../screens/DealDetailScreen';
import MapScreen from '../screens/MapScreen';

const Stack = createNativeStackNavigator();

export default function RadarStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RadarList" component={RadarScreen} />
      <Stack.Screen name="DealDetail" component={DealDetailScreen} />
      <Stack.Screen name="Map" component={MapScreen} options={{ headerShown: true, title: 'Store Map' }} />
    </Stack.Navigator>
  );
}
