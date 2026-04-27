import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { colors, font } from '../theme';
import type { RootStackParamList } from '../navigation/types';

export function NotificationBell() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const unread = useUnreadCount();

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Notifications')}
      style={s.container}
      activeOpacity={0.7}
    >
      <Text style={s.bell}>🔔</Text>
      {unread > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: {
    marginRight: 4,
    padding: 4,
  },
  bell: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: font.weight.bold,
    lineHeight: 12,
  },
});
