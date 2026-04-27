import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from './src/store/auth';
import { LoginScreen } from './src/screens/LoginScreen';
import { ConsumerDashboardScreen } from './src/screens/consumer/DashboardScreen';
import { BusinessSelectScreen } from './src/screens/consumer/BusinessSelectScreen';
import { PaymentScreen } from './src/screens/consumer/PaymentScreen';
import { EscrowDetailScreen } from './src/screens/consumer/EscrowDetailScreen';
import { BusinessDashboardScreen } from './src/screens/business/BusinessDashboardScreen';
import type { RootStackParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

function LogoutButton() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const qc = useQueryClient();
  return (
    <TouchableOpacity
      onPress={() => {
        qc.clear();
        clearAuth();
      }}
      style={{ marginRight: 8 }}
    >
      <Text style={{ color: '#FF3B30', fontSize: 15 }}>로그아웃</Text>
    </TouchableOpacity>
  );
}

function AppNavigator() {
  const role = useAuthStore((s) => s.role);
  const name = useAuthStore((s) => s.name);

  if (!role) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  if (role === 'business') {
    return (
      <Stack.Navigator
        screenOptions={{ headerRight: () => <LogoutButton /> }}
      >
        <Stack.Screen
          name="BusinessDashboard"
          component={BusinessDashboardScreen}
          options={{ title: `${name ?? '사업자'} 대시보드` }}
        />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerRight: () => <LogoutButton /> }}
    >
      <Stack.Screen
        name="ConsumerDashboard"
        component={ConsumerDashboardScreen}
        options={{ title: '내 선불보호' }}
      />
      <Stack.Screen
        name="BusinessSelect"
        component={BusinessSelectScreen}
        options={{ title: '사업자 선택' }}
      />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ title: '에스크로 생성' }}
      />
      <Stack.Screen
        name="EscrowDetail"
        component={EscrowDetailScreen}
        options={{ title: '에스크로 상세' }}
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
