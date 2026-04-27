import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { EscrowRecord, EscrowEntry } from '@prepaid-shield/shared-types';
import type { BusinessTabProps } from '../../navigation/types';

interface HistoryItem {
  id: string;
  type: 'received' | 'cancelled';
  date: Date;
  amount: number;
  consumerName: string;
  month: number;
}

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  received: { icon: '💰', label: '대금 수령', color: colors.success, bg: colors.successLight },
  cancelled: { icon: '↩️', label: '취소/환불', color: colors.gray500, bg: colors.gray100 },
};

export function BusinessHistoryScreen(_props: BusinessTabProps<'BusinessHistory'>) {
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
      for (const entry of escrow.entries) {
        if (entry.status === 'released') {
          items.push({
            id: entry.id,
            type: 'received',
            date: new Date((entry as any).updatedAt ?? (entry as any).createdAt ?? Date.now()),
            amount: Number(entry.amount),
            consumerName: escrow.consumer?.name ?? '소비자',
            month: entry.month,
          });
        } else if (entry.status === 'refunded') {
          items.push({
            id: entry.id,
            type: 'cancelled',
            date: new Date((entry as any).updatedAt ?? (entry as any).createdAt ?? Date.now()),
            amount: Number(entry.amount),
            consumerName: escrow.consumer?.name ?? '소비자',
            month: entry.month,
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
            <View style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                <Text style={styles.iconText}>{config.icon}</Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardLabel}>{config.label}</Text>
                <Text style={styles.cardSub}>
                  {item.consumerName} · {item.month}월차
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.cardAmount, { color: config.color }]}>
                  {item.type === 'received' ? '+' : '-'}{item.amount.toLocaleString()}
                </Text>
                <Text style={styles.cardCurrency}>RLUSD</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📜</Text>
            <Text style={styles.emptyTitle}>거래 내역이 없습니다</Text>
            <Text style={styles.emptyDesc}>릴리즈된 대금이 여기에 표시됩니다</Text>
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
