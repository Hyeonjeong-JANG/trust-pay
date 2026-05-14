import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { PaymentRequest } from '@prepaid-shield/shared-types';

// Consumer bottom tabs
export type ConsumerTabParamList = {
  Home: undefined;
  Schedule: undefined;
  History: undefined;
};

// Business bottom tabs
export type BusinessTabParamList = {
  Dashboard: undefined;
  BusinessCreatePayment: undefined;
  BusinessHistory: undefined;
};

// Root stack (wraps everything)
export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  ConsumerTabs: NavigatorScreenParams<ConsumerTabParamList>;
  BusinessSelect: undefined;
  ScanPayment: undefined;
  Payment: { businessId: string; businessName: string; businessCategory?: string; paymentRequest?: PaymentRequest };
  EscrowDetail: { id: string };
  Profile: undefined;
  BusinessEscrowDetail: { id: string };
  BusinessProfile: undefined;
  BusinessDetail: { businessId: string };
  BusinessTabs: NavigatorScreenParams<BusinessTabParamList>;
  Notifications: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

// Tab screen props with stack parent
export type ConsumerTabProps<T extends keyof ConsumerTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<ConsumerTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type BusinessTabProps<T extends keyof BusinessTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<BusinessTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
