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
import { SummaryCardSkeleton, TimelineEntrySkeleton } from '../../components/Skeleton';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { EscrowEntry, EscrowRecord } from '@prepaid-shield/shared-types';
import type { ConsumerTabProps } from '../../navigation/types';

type EscrowWithBusiness = EscrowRecord & { business?: { name: string } };

interface ScheduleItem {
  entry: EscrowEntry;
  escrow: EscrowWithBusiness;
  dateStr: string;
  isPast: boolean;
  isNext: boolean;
}

const RIPPLE_EPOCH = 946684800;

function rippleTimeToDate(rippleTime: number): Date {
  return new Date((rippleTime + RIPPLE_EPOCH) * 1000);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatRelative(d: Date): string {
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '오늘';
  if (days === 1) return '내일';
  if (days < 0) return `${Math.abs(days)}일 전`;
  if (days <= 30) return `${days}일 후`;
  const months = Math.ceil(days / 30);
  return `약 ${months}개월 후`;
}

export function ScheduleScreen(_props: ConsumerTabProps<'Schedule'>) {
  const userId = useAuthStore((s) => s.userId);

  const { data: escrows, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['consumerEscrows', userId],
    queryFn: () => api.getConsumerEscrows(userId!),
    enabled: !!userId,
    retry: 2,
  });

  const scheduleItems = useMemo((): ScheduleItem[] => {
    if (!escrows) return [];
    const items: ScheduleItem[] = [];
    const now = new Date();

    for (const escrow of escrows as EscrowWithBusiness[]) {
      if (escrow.status !== 'active') continue;
      for (const entry of escrow.entries) {
        if (entry.status !== 'pending') continue;
        const d = rippleTimeToDate(entry.finishAfter);
        items.push({
          entry,
          escrow,
          dateStr: formatDate(d),
          isPast: d < now,
          isNext: false,
        });
      }
    }

    items.sort((a, b) => a.entry.finishAfter - b.entry.finishAfter);

    // 다음 릴리즈 가능 항목 표시
    const nextIdx = items.findIndex((i) => !i.isPast);
    if (nextIdx >= 0) items[nextIdx].isNext = true;
    else if (items.length > 0) items[0].isNext = true;

    return items;
  }, [escrows]);

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.listContent}>
          <SummaryCardSkeleton />
          <TimelineEntrySkeleton />
          <TimelineEntrySkeleton />
          <TimelineEntrySkeleton />
        </View>
      </View>
    );
  }

  if (isError) {
    return <ErrorView error={error} onRetry={() => refetch()} />;
  }

  const totalPending = scheduleItems.length;
  const totalAmount = scheduleItems.reduce((s, i) => s + Number(i.entry.amount), 0);

  return (
    <View style={styles.container}>
      <FlatList
        data={scheduleItems}
        keyExtractor={(item) => item.entry.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>예정된 릴리즈</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalPending}</Text>
                  <Text style={styles.summaryLabel}>건</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalAmount.toLocaleString()}</Text>
                  <Text style={styles.summaryLabel}>RLUSD</Text>
                </View>
              </View>
            </View>
            {scheduleItems.length > 0 && (
              <Text style={styles.sectionTitle}>릴리즈 일정</Text>
            )}
          </>
        }
        renderItem={({ item, index }) => {
          const d = rippleTimeToDate(item.entry.finishAfter);
          const relativeStr = formatRelative(d);
          const isLast = index === scheduleItems.length - 1;
          return (
            <View style={styles.timelineRow}>
              {/* 타임라인 바 */}
              <View style={styles.timelineLeft}>
                <View style={[
                  styles.timelineDot,
                  item.isNext && styles.timelineDotNext,
                  item.isPast && styles.timelineDotPast,
                ]} />
                {!isLast && <View style={styles.timelineLine} />}
              </View>
              {/* 카드 */}
              <View style={[styles.scheduleCard, item.isNext && styles.scheduleCardNext]}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardDate}>{item.dateStr}</Text>
                  <Text style={[
                    styles.cardRelative,
                    item.isPast && styles.cardRelativePast,
                    item.isNext && styles.cardRelativeNext,
                  ]}>
                    {item.isPast ? '릴리즈 가능' : relativeStr}
                  </Text>
                </View>
                <Text style={styles.cardBusiness}>{item.escrow.business?.name ?? '사업자'}</Text>
                <View style={styles.cardBottom}>
                  <Text style={styles.cardMonth}>{item.entry.month}월차</Text>
                  <Text style={styles.cardAmount}>{Number(item.entry.amount).toLocaleString()} RLUSD</Text>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>예정된 릴리즈가 없습니다</Text>
            <Text style={styles.emptyDesc}>에스크로를 생성하면 릴리즈 일정이 표시됩니다</Text>
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
  summaryCard: {
    backgroundColor: colors.primary,
    padding: spacing.xl,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
    ...shadow.md,
  },
  summaryTitle: {
    fontSize: font.size.sm,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: spacing.md,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: colors.white,
  },
  summaryLabel: { fontSize: font.size.sm, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  sectionTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  timelineRow: { flexDirection: 'row', minHeight: 80 },
  timelineLeft: { width: 32, alignItems: 'center' },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gray300,
    marginTop: 16,
  },
  timelineDotNext: { backgroundColor: colors.primary, width: 14, height: 14, borderRadius: 7 },
  timelineDotPast: { backgroundColor: colors.success },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.gray200,
    marginTop: 4,
  },
  scheduleCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
    ...shadow.sm,
  },
  scheduleCardNext: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardDate: { fontSize: font.size.sm, color: colors.gray500 },
  cardRelative: {
    fontSize: font.size.xs,
    color: colors.gray400,
    fontWeight: font.weight.medium,
  },
  cardRelativePast: { color: colors.success },
  cardRelativeNext: { color: colors.primary, fontWeight: font.weight.semibold },
  cardBusiness: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMonth: { fontSize: font.size.sm, color: colors.gray400 },
  cardAmount: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.primary,
  },
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
