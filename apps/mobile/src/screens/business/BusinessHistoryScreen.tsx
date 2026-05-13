import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { ErrorView } from '../../components/ErrorView';
import { formatKrwFromRlusd, formatRlusd } from '../../utils/money';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { EscrowRecord } from '@prepaid-shield/shared-types';
import type { BusinessTabProps } from '../../navigation/types';

interface HistoryItem {
  id: string;
  escrowId: string;
  type: 'started' | 'received' | 'cancelled';
  date: Date;
  amount: number;
  consumerName: string;
  detail: string;
}

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  started: { icon: '🛡️', label: '보호 결제 시작', color: colors.primary, bg: colors.primaryLight },
  received: { icon: '💰', label: '대금 수령', color: colors.success, bg: colors.successLight },
  cancelled: { icon: '↩️', label: '취소/환불', color: colors.gray500, bg: colors.gray100 },
};

function getEscrowDetail(escrow: EscrowRecord): string {
  if (escrow.escrowType === 'prepaid') return '기간 금액권';
  return `월정액 ${escrow.months}개월`;
}

export function BusinessHistoryScreen({ navigation }: BusinessTabProps<'BusinessHistory'>) {
  const userId = useAuthStore((s) => s.userId);

  const { data: dashboard, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['businessDashboard', userId],
    queryFn: () => api.getBusinessDashboard(userId!),
    enabled: !!userId,
    retry: 2,
  });

  const historyItems = useMemo((): HistoryItem[] => {
    if (!dashboard?.escrows) return [];
    const items: HistoryItem[] = [];

    for (const escrow of dashboard.escrows as (EscrowRecord & { consumer?: { name: string } })[]) {
      const consumerName = escrow.consumer?.name ?? '소비자';
      items.push({
        id: `${escrow.id}:started`,
        escrowId: escrow.id,
        type: 'started',
        date: new Date(escrow.createdAt ?? Date.now()),
        amount: Number(escrow.totalAmount),
        consumerName,
        detail: getEscrowDetail(escrow),
      });

      for (const entry of escrow.entries) {
        if (entry.status === 'released') {
          items.push({
            id: entry.id,
            escrowId: escrow.id,
            type: 'received',
            date: new Date((entry as any).updatedAt ?? (entry as any).createdAt ?? Date.now()),
            amount: Number(entry.amount),
            consumerName,
            detail: escrow.escrowType === 'prepaid' ? '차감 정산' : `${entry.month}월차`,
          });
        } else if (entry.status === 'refunded') {
          items.push({
            id: entry.id,
            escrowId: escrow.id,
            type: 'cancelled',
            date: new Date((entry as any).updatedAt ?? (entry as any).createdAt ?? Date.now()),
            amount: Number(entry.amount),
            consumerName,
            detail: escrow.escrowType === 'prepaid' ? '환불' : `${entry.month}월차`,
          });
        }
      }
    }

    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return items;
  }, [dashboard]);

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return <ErrorView error={error} onRetry={() => refetch()} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={historyItems}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => {
          const config = TYPE_CONFIG[item.type];
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('BusinessEscrowDetail', { id: item.escrowId })}
              activeOpacity={0.86}
            >
              <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                <Text style={styles.iconText}>{config.icon}</Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardLabel}>{config.label}</Text>
                <Text style={styles.cardSub}>
                  {item.consumerName} · {item.detail}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.cardAmount, { color: config.color }]}>{item.type === 'received' ? '+' : item.type === 'cancelled' ? '-' : ''}{formatKrwFromRlusd(item.amount)}</Text>
                <Text style={styles.cardCurrency}>{formatRlusd(item.amount)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListHeaderComponent={
          <View style={styles.headerCard}>
            <Text style={styles.headerTitle}>전체 결제 내역</Text>
            <Text style={styles.headerDesc}>손님이 계좌 승인한 보호 결제부터 정산과 환불까지 모두 표시됩니다</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📜</Text>
            <Text style={styles.emptyTitle}>거래 내역이 없습니다</Text>
            <Text style={styles.emptyDesc}>보호 결제가 시작되면 여기에 표시됩니다</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  headerCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  headerTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.gray900 },
  headerDesc: { fontSize: font.size.sm, color: colors.gray500, marginTop: spacing.xs, lineHeight: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  iconText: { fontSize: 18 },
  cardContent: { flex: 1 },
  cardLabel: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.gray800 },
  cardSub: { fontSize: font.size.xs, color: colors.gray400, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardAmount: { fontSize: font.size.md, fontWeight: font.weight.bold },
  cardCurrency: { fontSize: font.size.xs, color: colors.gray400, marginTop: 1 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.gray700, marginBottom: spacing.xs },
  emptyDesc: { fontSize: font.size.sm, color: colors.gray400, textAlign: 'center' },
});
