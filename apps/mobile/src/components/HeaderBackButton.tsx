import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/auth';
import { colors } from '../theme';
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
      hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
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
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  icon: {
    color: colors.primary,
    fontSize: 28,
    lineHeight: 44,
    textAlign: 'center',
    transform: [{ translateY: -2.5 }],
  },
});
