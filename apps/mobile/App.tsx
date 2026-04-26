import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from './src/store/auth';
import { LoginScreen } from './src/screens/LoginScreen';
import { ConsumerDashboardScreen } from './src/screens/consumer/DashboardScreen';
import { PaymentScreen } from './src/screens/consumer/PaymentScreen';
import { BusinessDashboardScreen } from './src/screens/business/BusinessDashboardScreen';

const Stack = createNativeStackNavigator();
const queryClient = new QueryClient();

function AppNavigator() {
  const role = useAuthStore((s) => s.role);

  if (!role) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  if (role === 'business') {
    return (
      <Stack.Navigator>
        <Stack.Screen
          name="BusinessDashboard"
          component={BusinessDashboardScreen}
          options={{ title: 'Dashboard' }}
        />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ConsumerDashboard"
        component={ConsumerDashboardScreen}
        options={{ title: 'My Escrows' }}
      />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ title: 'New Payment' }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <AppNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </QueryClientProvider>
  );
}
