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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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

  const isFiltered = searchQuery.trim() !== '' || statusFilter !== 'all';

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
                <Text style={styles.balanceLabel}>RLUSD 잔액</Text>
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
          const released = item.entries.filter((e: EscrowEntry) => e.status === 'released').length;
          const statusStyle = STATUS_STYLE[item.status] ?? STATUS_STYLE.cancelled;
          const progressPct = item.months > 0 ? (released / item.months) * 100 : 0;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('EscrowDetail', { id: item.id })}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.businessName}>{item.business?.name ?? '사업자'}</Text>
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
                {released}/{item.months}개월 릴리즈됨
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>{isFiltered ? '🔍' : '📋'}</Text>
            </View>
            <Text style={styles.emptyTitle}>
              {isFiltered ? '검색 결과가 없습니다' : '에스크로가 없습니다'}
            </Text>
            <Text style={styles.emptyDesc}>
              {isFiltered
                ? '다른 검색어나 필터를 시도해보세요'
                : '아래 + 버튼을 눌러 첫 선불 보호를 시작하세요'}
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
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  businessName: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray900,
    flex: 1,
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
