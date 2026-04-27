import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

// Consumer bottom tabs
export type ConsumerTabParamList = {
  Home: undefined;
  Schedule: undefined;
  History: undefined;
  Profile: undefined;
};

// Business bottom tabs
export type BusinessTabParamList = {
  Dashboard: undefined;
  BusinessHistory: undefined;
  BusinessProfile: undefined;
};

// Root stack (wraps everything)
export type RootStackParamList = {
  Login: undefined;
  ConsumerTabs: NavigatorScreenParams<ConsumerTabParamList>;
  BusinessSelect: undefined;
  Payment: { businessId: string; businessName: string };
  EscrowDetail: { id: string };
  BusinessDetail: { businessId: string };
  BusinessTabs: NavigatorScreenParams<BusinessTabParamList>;
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
