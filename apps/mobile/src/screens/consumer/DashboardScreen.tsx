import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { ErrorView } from '../../components/ErrorView';
import { BalanceCardSkeleton, EscrowCardSkeleton } from '../../components/Skeleton';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { EscrowEntry } from '@prepaid-shield/shared-types';
import type { ConsumerTabProps } from '../../navigation/types';
import type { EscrowRecord, EscrowStatus } from '@prepaid-shield/shared-types';
type EscrowWithBusiness = EscrowRecord & { business?: { name: string } };

const STATUS_KO: Record<string, string> = {
  active: '진행중',
  completed: '완료',
  cancelled: '취소됨',
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  active: { bg: colors.escrow.activeBg, text: colors.escrow.active },
  completed: { bg: colors.escrow.completedBg, text: colors.escrow.completed },
  cancelled: { bg: colors.escrow.cancelledBg, text: colors.escrow.cancelled },
};

type StatusFilter = 'all' | EscrowStatus;

const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '진행중' },
  { key: 'completed', label: '완료' },
  { key: 'cancelled', label: '취소됨' },
];

export function ConsumerDashboardScreen({ navigation }: ConsumerTabProps<'Home'>) {
  const userId = useAuthStore((s) => s.userId);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const { data: escrows, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['consumerEscrows', userId],
    queryFn: () => api.getConsumerEscrows(userId!),
    enabled: !!userId,
    retry: 2,
  });

  const { data: balanceData, isLoading: balanceLoading, isError: balanceError, refetch: refetchBalance } = useQuery({
    queryKey: ['balance', userId],
    queryFn: () => api.getBalance(userId!, 'consumer'),
    enabled: !!userId,
    retry: 1,
  });

  const filteredEscrows = useMemo(() => {
    if (!escrows) return [];
    let result = escrows as EscrowWithBusiness[];
    if (statusFilter !== 'all') {
      result = result.filter((e) => e.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((e) =>
        (e.business?.name ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [escrows, statusFilter, searchQuery]);

  const hasSearchQuery = searchQuery.trim() !== '';
  const isFiltered = hasSearchQuery || statusFilter !== 'all';
  const emptyTitle = hasSearchQuery
    ? '검색 결과가 없습니다'
    : statusFilter === 'active'
      ? '진행중인 보호가 없습니다'
      : statusFilter === 'completed'
        ? '완료된 보호가 없습니다'
        : statusFilter === 'cancelled'
          ? '취소된 보호가 없습니다'
          : '에스크로가 없습니다';
  const emptyDesc = hasSearchQuery
    ? '다른 검색어나 필터를 시도해보세요'
    : statusFilter === 'active'
      ? '완료·취소된 보호는 상단 필터에서 확인할 수 있습니다'
      : statusFilter === 'all'
        ? '아래 + 버튼을 눌러 XRPL Token Escrow로 월별 릴리즈되는 선불 보호를 시작하세요'
        : '다른 상태 필터를 선택해 내 선불 보호를 확인해보세요';

  const onRefresh = useCallback(() => {
    refetch();
    refetchBalance();
  }, [refetch, refetchBalance]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.listContent}>
          <BalanceCardSkeleton />
          <EscrowCardSkeleton />
          <EscrowCardSkeleton />
        </View>
      </View>
    );
  }

  if (isError) {
    return <ErrorView error={error} onRetry={() => refetch()} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredEscrows}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* 잔액 카드 */}
            {balanceLoading ? (
              <View style={styles.balanceCard}>
                <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
              </View>
            ) : balanceError ? (
              <View style={[styles.balanceCard, styles.balanceCardError]}>
                <Text style={styles.balanceLabel}>RLUSD 잔액</Text>
                <Text style={styles.balanceValue}>조회 실패</Text>
              </View>
            ) : balanceData ? (
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>XRPL Testnet RLUSD 잔액</Text>
                <Text style={styles.balanceValue}>
                  {Number(balanceData.balance).toLocaleString()} RLUSD
                </Text>
                <Text style={styles.balanceAddr}>
                  {balanceData.xrplAddress.slice(0, 8)}...{balanceData.xrplAddress.slice(-6)}
                </Text>
              </View>
            ) : null}

            {/* 검색 바 */}
            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="사업자명 검색..."
                placeholderTextColor={colors.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                  <Text style={styles.clearBtn}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 필터 칩 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterRow}
              contentContainerStyle={styles.filterRowContent}
            >
              {FILTER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.filterChip,
                    statusFilter === opt.key && styles.filterChipActive,
                  ]}
                  onPress={() => setStatusFilter(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      statusFilter === opt.key && styles.filterChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>내 선불 보호</Text>
              {isFiltered && (
                <Text style={styles.resultCount}>{filteredEscrows.length}건</Text>
              )}
            </View>
          </>
        }
        renderItem={({ item }: { item: EscrowWithBusiness }) => {
          const isPrepaid = item.escrowType === 'prepaid';
          const released = item.entries.filter((e: EscrowEntry) => e.status === 'released').length;
          const pendingEntries = item.entries.filter((e: EscrowEntry) => e.status === 'pending');
          const fallbackMonthly = item.months > 0 ? item.totalAmount / item.months : 0;
          const totalEntries = item.entries.length || item.months;
          const pendingAmount = pendingEntries.reduce(
            (sum, entry) => sum + Number(entry.amount ?? fallbackMonthly),
            0,
          );
          const pendingChargeCount = item.chargeRequests?.filter((request) => request.status === 'pending_approval').length ?? 0;
          const statusStyle = STATUS_STYLE[item.status] ?? STATUS_STYLE.cancelled;
          const progressPct = totalEntries > 0 ? (released / totalEntries) * 100 : 0;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('EscrowDetail', { id: item.id })}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.businessName}>{item.business?.name ?? '사업자'}</Text>
                  <Text style={styles.modelLabel}>{isPrepaid ? '이용권 차감' : '월정액 정산'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                    {STATUS_KO[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.amount}>{item.totalAmount.toLocaleString()} RLUSD</Text>
              {/* 진행률 바 */}
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
              </View>
              <Text style={styles.progress}>
                {isPrepaid
                  ? `${released}/${totalEntries}회 사용됨`
                  : `${released}/${item.months}개월 릴리즈됨`}
              </Text>
              {pendingAmount > 0 && (
                <Text style={styles.pendingProtect}>
                  대기 보호금 {pendingAmount.toLocaleString()} RLUSD
                </Text>
              )}
              {pendingChargeCount > 0 && (
                <Text style={styles.pendingApproval}>
                  승인 대기 {pendingChargeCount}건
                </Text>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>{isFiltered ? '🔍' : '📋'}</Text>
            </View>
            <Text style={styles.emptyTitle}>
              {emptyTitle}
            </Text>
            <Text style={styles.emptyDesc}>
              {emptyDesc}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('BusinessSelect')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingBottom: 100 },
  balanceCard: {
    backgroundColor: colors.primary,
    padding: spacing.xl,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...shadow.md,
  },
  balanceCardError: { backgroundColor: colors.gray400 },
  balanceLabel: { fontSize: font.size.sm, color: 'rgba(255,255,255,0.75)' },
  balanceValue: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: colors.white,
    marginVertical: spacing.xs,
    letterSpacing: -0.5,
  },
  balanceAddr: {
    fontSize: font.size.xs,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: font.mono,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    fontSize: font.size.md,
    color: colors.gray900,
    paddingVertical: spacing.xs,
  },
  clearBtn: {
    fontSize: font.size.md,
    color: colors.gray400,
    padding: spacing.xs,
  },
  filterRow: { marginBottom: spacing.md },
  filterRowContent: { gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: font.size.sm,
    color: colors.gray600,
    fontWeight: font.weight.medium,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.gray900,
  },
  resultCount: {
    fontSize: font.size.sm,
    color: colors.gray400,
    fontWeight: font.weight.medium,
  },
  card: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardTitleBlock: { flex: 1, marginRight: spacing.md },
  businessName: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray900,
  },
  modelLabel: {
    fontSize: font.size.xs,
    color: colors.primary,
    fontWeight: font.weight.semibold,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  badgeText: { fontSize: font.size.xs, fontWeight: font.weight.semibold },
  amount: {
    fontSize: font.size.md,
    color: colors.gray700,
    fontWeight: font.weight.medium,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: 2,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: colors.success,
    borderRadius: 2,
  },
  progress: {
    fontSize: font.size.sm,
    color: colors.gray400,
    marginTop: spacing.xs,
  },
  pendingProtect: {
    fontSize: font.size.sm,
    color: colors.primary,
    fontWeight: font.weight.semibold,
    marginTop: spacing.xs,
  },
  pendingApproval: {
    fontSize: font.size.sm,
    color: colors.danger,
    fontWeight: font.weight.semibold,
    marginTop: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyIconText: { fontSize: 28 },
  emptyTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray700,
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    fontSize: font.size.sm,
    color: colors.gray400,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.lg,
  },
  fabText: { color: colors.white, fontSize: 28, fontWeight: font.weight.normal, marginTop: -2 },
});
