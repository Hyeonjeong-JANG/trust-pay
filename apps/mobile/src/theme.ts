import { Platform, StyleSheet } from 'react-native';

export const colors = {
  primary: '#2E6FF3',
  primaryLight: '#EBF1FF',
  primaryDark: '#1A4FBF',

  success: '#00C48C',
  successLight: '#E6FAF3',
  warning: '#FF9F0A',
  warningLight: '#FFF5E6',
  danger: '#FF3B30',
  dangerLight: '#FFECEB',

  gray50: '#F8F9FC',
  gray100: '#F1F3F8',
  gray200: '#E4E7EE',
  gray300: '#C8CDD8',
  gray400: '#9DA3B0',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#0F172A',

  white: '#FFFFFF',
  background: '#F5F7FA',

  escrow: {
    active: '#00C48C',
    activeBg: '#E6FAF3',
    completed: '#2E6FF3',
    completedBg: '#EBF1FF',
    cancelled: '#9DA3B0',
    cancelledBg: '#F1F3F8',
  },

  entry: {
    pending: '#FF9F0A',
    pendingBg: '#FFF5E6',
    released: '#00C48C',
    releasedBg: '#E6FAF3',
    refunded: '#9DA3B0',
    refundedBg: '#F1F3F8',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const font = {
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
    hero: 34,
  },
  weight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const shadow = StyleSheet.create({
  sm: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
