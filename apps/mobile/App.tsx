import React, { useEffect } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { NetworkBanner } from './src/components/NetworkBanner';
import { useAuthStore } from './src/store/auth';
import { useAppStore } from './src/store/app';
import { LoginScreen } from './src/screens/LoginScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { NotificationBell } from './src/components/NotificationBell';
import { NotificationsScreen } from './src/screens/consumer/NotificationsScreen';
import { ConsumerDashboardScreen } from './src/screens/consumer/DashboardScreen';
import { ScheduleScreen } from './src/screens/consumer/ScheduleScreen';
import { HistoryScreen } from './src/screens/consumer/HistoryScreen';
import { ProfileScreen } from './src/screens/consumer/ProfileScreen';
import { BusinessSelectScreen } from './src/screens/consumer/BusinessSelectScreen';
import { PaymentScreen } from './src/screens/consumer/PaymentScreen';
import { EscrowDetailScreen } from './src/screens/consumer/EscrowDetailScreen';
import { BusinessDashboardScreen } from './src/screens/business/BusinessDashboardScreen';
import { BusinessHistoryScreen } from './src/screens/business/BusinessHistoryScreen';
import { BusinessProfileScreen } from './src/screens/business/BusinessProfileScreen';
import { colors, font } from './src/theme';
import type { RootStackParamList, ConsumerTabParamList, BusinessTabParamList } from './src/navigation/types';

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator<RootStackParamList>();
const ConsumerTab = createBottomTabNavigator<ConsumerTabParamList>();
const BusinessTab = createBottomTabNavigator<BusinessTabParamList>();
const queryClient = new QueryClient();

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.white },
  headerTitleStyle: { fontWeight: font.weight.semibold, fontSize: font.size.lg, color: colors.gray900 },
  headerShadowVisible: false,
  headerTintColor: colors.primary,
} as const;

const tabScreenOptions = {
  headerStyle: { backgroundColor: colors.white },
  headerTitleStyle: { fontWeight: font.weight.semibold, fontSize: font.size.lg, color: colors.gray900 },
  headerShadowVisible: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.gray400,
  tabBarStyle: { borderTopColor: colors.gray200, backgroundColor: colors.white },
  tabBarLabelStyle: { fontSize: 11, fontWeight: font.weight.medium as '500' },
} as const;

function LogoutButton() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const qc = useQueryClient();
  return (
    <TouchableOpacity
      onPress={() => { qc.clear(); clearAuth(); }}
      style={{ marginRight: 8 }}
      activeOpacity={0.7}
    >
      <Text style={{ color: colors.danger, fontSize: font.size.md, fontWeight: font.weight.medium }}>로그아웃</Text>
    </TouchableOpacity>
  );
}

function ConsumerHeaderRight() {
  return (
    <>{<NotificationBell />}<LogoutButton /></>
  );
}

function ConsumerTabs() {
  return (
    <ConsumerTab.Navigator screenOptions={{ ...tabScreenOptions, headerRight: () => <ConsumerHeaderRight /> }}>
      <ConsumerTab.Screen name="Home" component={ConsumerDashboardScreen}
        options={{ title: '홈', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text> }} />
      <ConsumerTab.Screen name="Schedule" component={ScheduleScreen}
        options={{ title: '일정', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📅</Text> }} />
      <ConsumerTab.Screen name="History" component={HistoryScreen}
        options={{ title: '내역', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📜</Text> }} />
      <ConsumerTab.Screen name="Profile" component={ProfileScreen}
        options={{ title: '프로필', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text> }} />
    </ConsumerTab.Navigator>
  );
}

function BusinessTabs() {
  const name = useAuthStore((s) => s.name);
  return (
    <BusinessTab.Navigator screenOptions={{ ...tabScreenOptions, headerRight: () => <LogoutButton /> }}>
      <BusinessTab.Screen name="Dashboard" component={BusinessDashboardScreen}
        options={{ title: `${name ?? '사업자'} 대시보드`, tabBarLabel: '대시보드',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏪</Text> }} />
      <BusinessTab.Screen name="BusinessHistory" component={BusinessHistoryScreen}
        options={{ title: '거래 내역', tabBarLabel: '내역',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📜</Text> }} />
      <BusinessTab.Screen name="BusinessProfile" component={BusinessProfileScreen}
        options={{ title: '프로필', tabBarLabel: '프로필',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text> }} />
    </BusinessTab.Navigator>
  );
}

function AppNavigator() {
  const role = useAuthStore((s) => s.role);
  const hasSeenOnboarding = useAppStore((s) => s.hasSeenOnboarding);

  if (!role) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!hasSeenOnboarding && (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        )}
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  if (role === 'business') {
    return (
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="BusinessTabs" component={BusinessTabs} options={{ headerShown: false }} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ConsumerTabs" component={ConsumerTabs} options={{ headerShown: false }} />
      <Stack.Screen name="BusinessSelect" component={BusinessSelectScreen} options={{ title: '사업자 선택' }} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: '에스크로 생성' }} />
      <Stack.Screen name="EscrowDetail" component={EscrowDetailScreen} options={{ title: '에스크로 상세' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: '알림' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const hasHydrated = useAppStore((s) => s._hasHydrated);

  useEffect(() => {
    if (hasHydrated) {
      SplashScreen.hideAsync();
    }
  }, [hasHydrated]);

  if (!hasHydrated) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <NetworkBanner />
          <AppNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
