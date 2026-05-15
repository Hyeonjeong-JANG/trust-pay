import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/auth';
import { colors, spacing } from '../theme';
import type { RootStackParamList } from '../navigation/types';

export function HeaderBackButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const role = useAuthStore((s) => s.role);

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (role === 'business') {
      navigation.navigate('BusinessTabs', { screen: 'Dashboard' });
      return;
    }
    if (role === 'consumer') {
      navigation.navigate('ConsumerTabs', { screen: 'Home' });
    }
  };

  return (
    <TouchableOpacity
      accessibilityLabel="뒤로 가기"
      accessibilityRole="button"
      activeOpacity={0.75}
      onPress={goBack}
      style={styles.button}
    >
      <Text style={styles.icon}>‹</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: -spacing.xs,
    minHeight: 40,
    paddingRight: spacing.sm,
  },
  icon: {
    color: colors.primary,
    fontSize: 28,
    lineHeight: 30,
  },
});
