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
import { formatKrwFromRlusd, formatKrwWithRlusd, formatRlusd } from '../../utils/money';
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

interface PrepaidSummary {
  escrow: EscrowWithBusiness;
  remainingAmount: number;
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
      if (escrow.escrowType === 'prepaid') continue;
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

    // 다음 정산 가능 항목 표시
    const nextIdx = items.findIndex((i) => !i.isPast);
    if (nextIdx >= 0) items[nextIdx].isNext = true;
    else if (items.length > 0) items[0].isNext = true;

    return items;
  }, [escrows]);

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const prepaidSummaries = useMemo((): PrepaidSummary[] => {
    if (!escrows) return [];
    return (escrows as EscrowWithBusiness[])
      .filter((escrow) => escrow.status === 'active' && escrow.escrowType === 'prepaid')
      .map((escrow) => {
        const settledChargeAmount = escrow.chargeRequests
          ?.filter((request) => request.status === 'settled')
          .reduce((sum, request) => sum + Number(request.amount), 0) ?? 0;
        const releasedEntryAmount = escrow.entries
          .filter((entry) => entry.status === 'released')
          .reduce((sum, entry) => sum + Number(entry.amount), 0);
        const refundedEntryAmount = escrow.entries
          .filter((entry) => entry.status === 'refunded')
          .reduce((sum, entry) => sum + Number(entry.amount), 0);
        const usedAmount = settledChargeAmount > 0 ? settledChargeAmount : releasedEntryAmount;
        return {
          escrow,
          remainingAmount: Math.max(Number(escrow.totalAmount) - usedAmount - refundedEntryAmount, 0),
        };
      });
  }, [escrows]);

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
              <Text style={styles.summaryTitle}>예정된 정산</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalPending}</Text>
                  <Text style={styles.summaryLabel}>건</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{formatKrwFromRlusd(totalAmount)}</Text>
                  <Text style={styles.summaryLabel}>{formatRlusd(totalAmount)}</Text>
                </View>
              </View>
              <Text style={styles.summaryDesc}>
                대기 월차는 정산 가능 시점 기준으로 표시됩니다
              </Text>
            </View>
            {prepaidSummaries.length > 0 && (
              <View style={styles.prepaidCard}>
                <Text style={styles.prepaidTitle}>금액권 잔액</Text>
                {prepaidSummaries.map((item) => (
                  <Text key={item.escrow.id} style={styles.prepaidText}>
                    {item.escrow.business?.name ?? '사업자'} - 잔액 {formatKrwFromRlusd(item.remainingAmount)}
                  </Text>
                ))}
              </View>
            )}
            {scheduleItems.length > 0 && (
              <Text style={styles.sectionTitle}>정산 일정</Text>
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
                    {item.isPast ? '정산 가능' : relativeStr}
                  </Text>
                </View>
                <Text style={styles.cardBusiness}>{item.escrow.business?.name ?? '사업자'}</Text>
                <View style={styles.cardBottom}>
                  <Text style={styles.cardMonth}>{item.entry.month}월차</Text>
                  <Text style={styles.cardAmount}>{formatKrwWithRlusd(item.entry.amount)}</Text>
                </View>
                <Text style={styles.cardLedgerNote}>
                  {item.isPast
                    ? '정산 가능 시점 이후입니다. 사업자가 수령할 수 있습니다.'
                    : '정산 가능 시점까지 보호 상태로 보관됩니다.'}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>예정된 정산이 없습니다</Text>
            <Text style={styles.emptyDesc}>활성 보호 결제의 대기 월차가 생기면 정산 가능 시점 기준으로 표시됩니다</Text>
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
  summaryDesc: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: font.size.xs,
    lineHeight: 18,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  prepaidCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    ...shadow.sm,
  },
  prepaidTitle: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  prepaidText: {
    fontSize: font.size.sm,
    color: colors.gray600,
    lineHeight: 20,
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
  cardLedgerNote: {
    fontSize: font.size.xs,
    color: colors.gray500,
    lineHeight: 18,
    marginTop: spacing.sm,
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
