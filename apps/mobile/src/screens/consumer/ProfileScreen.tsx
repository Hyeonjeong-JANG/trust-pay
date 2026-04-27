import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { ConsumerTabProps } from '../../navigation/types';

export function ProfileScreen(_props: ConsumerTabProps<'Profile'>) {
  const userId = useAuthStore((s) => s.userId);
  const name = useAuthStore((s) => s.name);
  const role = useAuthStore((s) => s.role);

  const { data: balanceData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['balance', userId],
    queryFn: () => api.getBalance(userId!, role ?? 'consumer'),
    enabled: !!userId,
    retry: 1,
  });

  const copyAddress = async () => {
    if (balanceData?.xrplAddress) {
      await Clipboard.setStringAsync(balanceData.xrplAddress);
      Alert.alert('복사됨', 'XRPL 주소가 클립보드에 복사되었습니다.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      {/* 프로필 헤더 */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(name ?? '?')[0]}</Text>
        </View>
        <Text style={styles.name}>{name ?? '사용자'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {role === 'consumer' ? '소비자' : '사업자'}
          </Text>
        </View>
      </View>

      {/* XRPL 지갑 정보 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>XRPL 지갑</Text>
        <View style={styles.card}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : balanceData ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>잔액</Text>
                <Text style={styles.infoValue}>
                  {Number(balanceData.balance).toLocaleString()} RLUSD
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>주소</Text>
                <Text style={styles.addressValue} numberOfLines={1}>
                  {balanceData.xrplAddress}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={copyAddress}
                activeOpacity={0.7}
              >
                <Text style={styles.copyButtonText}>주소 복사</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.errorText}>지갑 정보를 불러올 수 없습니다</Text>
          )}
        </View>
      </View>

      {/* 앱 정보 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앱 정보</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>네트워크</Text>
            <Text style={styles.infoValue}>XRPL Testnet</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>통화</Text>
            <Text style={styles.infoValue}>RLUSD</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>에스크로</Text>
            <Text style={styles.infoValue}>Token Escrow (XLS-85)</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadow.md,
  },
  avatarText: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: colors.white,
  },
  name: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  roleBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  roleText: {
    fontSize: font.size.sm,
    color: colors.primary,
    fontWeight: font.weight.medium,
  },
  section: { marginTop: spacing.xl },
  sectionTitle: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadow.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLabel: { fontSize: font.size.md, color: colors.gray500 },
  infoValue: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.gray900 },
  addressValue: {
    fontSize: font.size.sm,
    fontFamily: font.mono,
    color: colors.gray700,
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  divider: { height: 1, backgroundColor: colors.gray100 },
  copyButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  copyButtonText: {
    color: colors.primary,
    fontWeight: font.weight.semibold,
    fontSize: font.size.sm,
  },
  errorText: { fontSize: font.size.md, color: colors.gray400, textAlign: 'center' },
});
