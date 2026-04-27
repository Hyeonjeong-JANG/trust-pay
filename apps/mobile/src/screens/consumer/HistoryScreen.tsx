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
import { HistoryCardSkeleton, SkeletonBox } from '../../components/Skeleton';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { EscrowRecord, EscrowEntry } from '@prepaid-shield/shared-types';
import type { ConsumerTabProps } from '../../navigation/types';

type EscrowWithBusiness = EscrowRecord & { business?: { name: string } };

interface HistoryItem {
  id: string;
  type: 'created' | 'released' | 'refunded';
  date: Date;
  amount: number;
  businessName: string;
  month?: number;
  escrowId: string;
}

const RIPPLE_EPOCH = 946684800;

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  created: { icon: '📝', label: '에스크로 생성', color: colors.primary, bg: colors.primaryLight },
  released: { icon: '✅', label: '릴리즈 완료', color: colors.success, bg: colors.successLight },
  refunded: { icon: '↩️', label: '환불됨', color: colors.gray500, bg: colors.gray100 },
};

export function HistoryScreen(_props: ConsumerTabProps<'History'>) {
  const userId = useAuthStore((s) => s.userId);

  const { data: escrows, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['consumerEscrows', userId],
    queryFn: () => api.getConsumerEscrows(userId!),
    enabled: !!userId,
    retry: 2,
  });

  const historyItems = useMemo((): HistoryItem[] => {
    if (!escrows) return [];
    const items: HistoryItem[] = [];

    for (const escrow of escrows as EscrowWithBusiness[]) {
      const bizName = escrow.business?.name ?? '사업자';

      // 에스크로 생성 이벤트
      items.push({
        id: `${escrow.id}-created`,
        type: 'created',
        date: new Date(escrow.createdAt),
        amount: escrow.totalAmount,
        businessName: bizName,
        escrowId: escrow.id,
      });

      // entry별 릴리즈/환불 이벤트
      for (const entry of escrow.entries) {
        if (entry.status === 'released' || entry.status === 'refunded') {
          items.push({
            id: entry.id,
            type: entry.status,
            date: new Date((entry as any).updatedAt ?? (entry as any).createdAt ?? Date.now()),
            amount: Number(entry.amount),
            businessName: bizName,
            month: entry.month,
            escrowId: escrow.id,
          });
        }
      }
    }

    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return items;
  }, [escrows]);

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.listContent}>
          <SkeletonBox width={120} height={13} style={{ marginBottom: spacing.sm }} />
          <HistoryCardSkeleton />
          <HistoryCardSkeleton />
          <HistoryCardSkeleton />
        </View>
      </View>
    );
  }

  if (isError) {
    return <ErrorView error={error} onRetry={() => refetch()} />;
  }

  // 날짜별 그룹핑
  const grouped = useMemo(() => {
    const groups: { title: string; data: HistoryItem[] }[] = [];
    let currentDate = '';
    for (const item of historyItems) {
      const dateKey = item.date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
      if (dateKey !== currentDate) {
        currentDate = dateKey;
        groups.push({ title: dateKey, data: [] });
      }
      groups[groups.length - 1].data.push(item);
    }
    return groups;
  }, [historyItems]);

  // FlatList에서 섹션 헤더를 포함한 아이템 리스트
  const flatItems = useMemo(() => {
    const result: (HistoryItem | { type: 'header'; title: string; id: string })[] = [];
    for (const group of grouped) {
      result.push({ type: 'header', title: group.title, id: `h-${group.title}` });
      result.push(...group.data);
    }
    return result;
  }, [grouped]);

  return (
    <View style={styles.container}>
      <FlatList
        data={flatItems}
        keyExtractor={(item) => 'id' in item ? item.id : ''}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => {
          if ('title' in item && item.type === 'header') {
            return <Text style={styles.dateHeader}>{item.title}</Text>;
          }
          const hi = item as HistoryItem;
          const config = TYPE_CONFIG[hi.type];
          return (
            <View style={styles.historyCard}>
              <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                <Text style={styles.iconText}>{config.icon}</Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardLabel}>{config.label}</Text>
                <Text style={styles.cardBusiness}>
                  {hi.businessName}
                  {hi.month ? ` · ${hi.month}월차` : ''}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.cardAmount, { color: config.color }]}>
                  {hi.type === 'refunded' ? '+' : hi.type === 'created' ? '-' : '+'}{hi.amount.toLocaleString()}
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
            <Text style={styles.emptyDesc}>에스크로 활동이 여기에 기록됩니다</Text>
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
  dateHeader: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.gray400,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  historyCard: {
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
  cardLabel: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.gray800,
  },
  cardBusiness: { fontSize: font.size.xs, color: colors.gray400, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardAmount: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
  },
  cardCurrency: { fontSize: font.size.xs, color: colors.gray400, marginTop: 1 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray700,
    marginBottom: spacing.xs,
  },
  emptyDesc: { fontSize: font.size.sm, color: colors.gray400, textAlign: 'center' },
});
