import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Login: undefined;
  ConsumerDashboard: undefined;
  BusinessSelect: undefined;
  Payment: { businessId: string; businessName: string };
  EscrowDetail: { id: string };
  BusinessDashboard: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
