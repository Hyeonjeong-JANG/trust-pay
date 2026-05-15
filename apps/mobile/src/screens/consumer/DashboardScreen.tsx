import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { ApprovalAuthModal } from '../../components/ApprovalAuthModal';
import { ErrorView } from '../../components/ErrorView';
import { BalanceCardSkeleton, EscrowCardSkeleton } from '../../components/Skeleton';
import { formatKrwFromRlusd, formatRlusd } from '../../utils/money';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { ChargeRequest, EscrowEntry, RefundReviewRequest } from '@prepaid-shield/shared-types';
import type { ConsumerTabProps } from '../../navigation/types';
import type { EscrowRecord, EscrowStatus } from '@prepaid-shield/shared-types';
type EscrowWithBusiness = EscrowRecord & { business?: { name: string } };
type PendingChargeApproval = ChargeRequest & { escrowId: string; businessName: string };

function sumEntryAmounts(entries: EscrowEntry[], status: EscrowEntry['status']): number {
  return entries
    .filter((entry) => entry.status === status)
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
}

function getPrepaidAmounts(escrow: EscrowWithBusiness) {
  const totalAmount = Number(escrow.totalAmount);
  const settledChargeAmount = escrow.chargeRequests
    ?.filter((request) => request.status === 'settled')
    .reduce((sum, request) => sum + Number(request.amount), 0) ?? 0;
  const releasedEntryAmount = sumEntryAmounts(escrow.entries, 'released');
  const refundedEntryAmount = sumEntryAmounts(escrow.entries, 'refunded');
  const usedAmount = settledChargeAmount > 0 ? settledChargeAmount : releasedEntryAmount;
  return {
    usedAmount,
    remainingAmount: Math.max(totalAmount - usedAmount - refundedEntryAmount, 0),
  };
}

function getLatestRefundReview(requests?: RefundReviewRequest[]): RefundReviewRequest | null {
  if (!requests?.length) return null;
  return [...requests].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0] ?? null;
}

const STATUS_KO: Record<string, string> = {
  active: '진행중',
  completed: '완료',
  cancelled: '취소됨',
  cancel_failed: '취소 재시도 필요',
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  active: { bg: colors.escrow.activeBg, text: colors.escrow.active },
  completed: { bg: colors.escrow.completedBg, text: colors.escrow.completed },
  cancelled: { bg: colors.escrow.cancelledBg, text: colors.escrow.cancelled },
  cancel_failed: { bg: colors.escrow.cancelledBg, text: colors.escrow.cancelled },
};

const REFUND_REVIEW_STATUS_KO: Record<string, string> = {
  platform_review: 'TrustPay 확인 중',
  merchant_response_requested: '사업자 답변 대기',
  merchant_responded: '사업자 답변 완료',
  platform_investigation: 'TrustPay 추가 확인 중',
  platform_approved: 'TrustPay 환불 승인',
  refunded: '환불 완료',
  rejected: '환불 검토 거절',
};

type StatusFilter = 'all' | EscrowStatus;

const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '진행중' },
  { key: 'completed', label: '완료' },
  { key: 'cancelled', label: '취소됨' },
  { key: 'cancel_failed', label: '취소 재시도 필요' },
];

export function ConsumerDashboardScreen({ navigation }: ConsumerTabProps<'Home'>) {
  const userId = useAuthStore((s) => s.userId);
  const name = useAuthStore((s) => s.name);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [chargeApprovalToAuthenticate, setChargeApprovalToAuthenticate] = useState<PendingChargeApproval | null>(null);

  const { data: escrows, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['consumerEscrows', userId],
    queryFn: () => api.getConsumerEscrows(userId!),
    enabled: !!userId,
    retry: 2,
  });

  const approveChargeMutation = useMutation({
    mutationFn: ({ requestId }: { requestId: string; escrowId: string }) => api.approveChargeRequest(requestId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consumerEscrows'] });
      queryClient.invalidateQueries({ queryKey: ['escrow', variables.escrowId] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      showSuccessToast('현장 승인 완료', '소비자 승인 후 XRPL 정산이 실행되었습니다.');
    },
    onError: (err: Error) => {
      const apiErr = err as import('../../api/client').ApiError;
      showErrorToast('현장 승인 실패', apiErr.userMessage ?? err.message);
    },
  });

  const rejectChargeMutation = useMutation({
    mutationFn: ({ requestId }: { requestId: string; escrowId: string }) => api.rejectChargeRequest(requestId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consumerEscrows'] });
      queryClient.invalidateQueries({ queryKey: ['escrow', variables.escrowId] });
      showSuccessToast('차감 요청 거절', '사업자에게 거절 상태로 표시됩니다.');
    },
    onError: (err: Error) => {
      const apiErr = err as import('../../api/client').ApiError;
      showErrorToast('차감 거절 실패', apiErr.userMessage ?? err.message);
    },
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

  const pendingChargeApproval = useMemo<PendingChargeApproval | null>(() => {
    for (const escrow of (escrows ?? []) as EscrowWithBusiness[]) {
      const request = escrow.chargeRequests?.find((item) => item.status === 'pending_approval');
      if (request) {
        return {
          ...request,
          escrowId: escrow.id,
          businessName: escrow.business?.name ?? '사업자',
        };
      }
    }
    return null;
  }, [escrows]);

  const hasSearchQuery = searchQuery.trim() !== '';
  const isFiltered = hasSearchQuery || statusFilter !== 'all';
  const hasPrepaidInFiltered = filteredEscrows.some((escrow) => escrow.escrowType === 'prepaid');
  const emptyTitle = hasSearchQuery
    ? '검색 결과가 없습니다'
    : statusFilter === 'active'
      ? '진행중인 보호가 없습니다'
      : statusFilter === 'completed'
        ? '완료된 보호가 없습니다'
        : statusFilter === 'cancelled'
          ? '취소된 보호가 없습니다'
          : '보호 결제가 없습니다';
  const emptyDesc = hasSearchQuery
    ? '다른 검색어나 필터를 시도해보세요'
    : statusFilter === 'active'
      ? '사업자가 제시한 QR을 스캔해 보호 결제를 시작하세요'
      : statusFilter === 'all'
        ? '아래 QR 스캔 결제로 사업자 청구를 승인하세요'
        : '다른 상태 필터를 선택해 내 선불 보호를 확인해보세요';

  const displayName = name?.trim() || '고객';
  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);
  const approvalActionPending = approveChargeMutation.isPending || rejectChargeMutation.isPending;

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
            <View style={styles.homeHeader}>
              <Text style={styles.greeting}>{displayName}님, 안녕하세요</Text>
              <Text style={styles.greetingSub}>오늘의 선불 보호를 확인해보세요</Text>
            </View>

            <View style={styles.balanceCard}>
              <View style={styles.balanceTopRow}>
                <Text style={styles.balanceLabel}>계좌 승인 결제</Text>
                <Text style={styles.balanceBadge}>준비됨</Text>
              </View>
              <Text style={styles.balanceValue}>승인하면 보호 시작</Text>
              <Text style={styles.balanceDesc}>선불금은 이용 전까지 잠겨 있어요</Text>
            </View>

            {pendingChargeApproval && (
              <View style={styles.approvalCard}>
                <View style={styles.approvalHeader}>
                  <Text style={styles.approvalEyebrow}>푸시 승인 대기</Text>
                  <Text style={styles.approvalBadge}>이용분 승인 요청</Text>
                </View>
                <Text style={styles.approvalTitle}>
                  {pendingChargeApproval.businessName}에서 {pendingChargeApproval.menuName} {formatKrwFromRlusd(pendingChargeApproval.amount)} 차감 요청
                </Text>
                <Text style={styles.approvalSub}>{formatRlusd(pendingChargeApproval.amount)}</Text>
                <Text style={styles.approvalDesc}>
                  지금 승인하면 보호 금액권 잔액에서 해당 이용금액만 정산됩니다.
                </Text>
                <View style={styles.approvalActions}>
                  <TouchableOpacity
                    style={[styles.approvalPrimaryButton, approvalActionPending && styles.buttonDisabled]}
                    onPress={() => setChargeApprovalToAuthenticate(pendingChargeApproval)}
                    disabled={approvalActionPending}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.approvalPrimaryText}>승인하고 정산</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.approvalSecondaryButton, approvalActionPending && styles.buttonDisabled]}
                    onPress={() => rejectChargeMutation.mutate({ requestId: pendingChargeApproval.id, escrowId: pendingChargeApproval.escrowId })}
                    disabled={approvalActionPending}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.approvalSecondaryText}>거절</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

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
            {hasPrepaidInFiltered && (
              <Text style={styles.sectionHint}>승인된 실제 사용금액 기준으로 잔액이 줄어듭니다</Text>
            )}
          </>
        }
        renderItem={({ item }: { item: EscrowWithBusiness }) => {
          const isPrepaid = item.escrowType === 'prepaid';
          const released = item.entries.filter((e: EscrowEntry) => e.status === 'released').length;
          const pendingEntries = item.entries.filter((e: EscrowEntry) => e.status === 'pending');
          const fallbackMonthly = item.months > 0 ? item.totalAmount / item.months : 0;
          const totalEntries = item.entries.length || item.months;
          const prepaidAmounts = isPrepaid ? getPrepaidAmounts(item) : null;
          const monthlyReleasedAmount = isPrepaid
            ? 0
            : item.entries
                .filter((entry: EscrowEntry) => entry.status === 'released')
                .reduce((sum, entry) => sum + Number(entry.amount ?? fallbackMonthly), 0);
          const monthlyPendingAmount = pendingEntries.reduce(
            (sum, entry) => sum + Number(entry.amount ?? fallbackMonthly),
            0,
          );
          const pendingChargeCount = item.chargeRequests?.filter((request) => request.status === 'pending_approval').length ?? 0;
          const latestRefundReview = getLatestRefundReview(item.refundReviewRequests);
          const statusStyle = STATUS_STYLE[item.status] ?? STATUS_STYLE.cancelled;
          const progressPct = isPrepaid
            ? Number(item.totalAmount) > 0 ? ((prepaidAmounts?.usedAmount ?? 0) / Number(item.totalAmount)) * 100 : 0
            : totalEntries > 0 ? (released / totalEntries) * 100 : 0;
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
              <Text style={styles.amount}>{formatKrwFromRlusd(item.totalAmount)}</Text>
              <Text style={styles.amountSub}>{formatRlusd(item.totalAmount)}</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
              </View>
              {isPrepaid ? (
                <Text style={styles.progress}>사용 {formatKrwFromRlusd(prepaidAmounts?.usedAmount ?? 0)} · 잔액 {formatKrwFromRlusd(prepaidAmounts?.remainingAmount ?? 0)}</Text>
              ) : (
                <Text style={styles.progress}>정산 {formatKrwFromRlusd(monthlyReleasedAmount)} · 잔여 {formatKrwFromRlusd(monthlyPendingAmount)}</Text>
              )}
              {pendingChargeCount > 0 && (
                <Text style={styles.pendingApproval}>
                  승인 대기 {pendingChargeCount}건
                </Text>
              )}
              {latestRefundReview && (
                <Text style={styles.refundReviewBadge}>
                  환불 검토 중: {REFUND_REVIEW_STATUS_KO[latestRefundReview.status] ?? latestRefundReview.status}
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
        onPress={() => navigation.navigate('ScanPayment')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>QR 스캔 결제</Text>
      </TouchableOpacity>
      <ApprovalAuthModal
        visible={!!chargeApprovalToAuthenticate}
        title="결제 승인 인증"
        description="이용금액 차감을 승인하려면 본인 인증이 필요합니다."
        onCancel={() => setChargeApprovalToAuthenticate(null)}
        onAuthenticated={() => {
          const request = chargeApprovalToAuthenticate;
          if (!request) return;

          setChargeApprovalToAuthenticate(null);
          approveChargeMutation.mutate({ requestId: request.id, escrowId: request.escrowId });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingBottom: 100 },
  homeHeader: {
    marginBottom: spacing.md,
  },
  greeting: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: colors.gray900,
    letterSpacing: -0.6,
  },
  greetingSub: {
    fontSize: font.size.sm,
    color: colors.gray500,
    marginTop: spacing.xs,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  balanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  balanceLabel: { fontSize: font.size.sm, color: 'rgba(255,255,255,0.75)' },
  balanceBadge: {
    fontSize: font.size.xs,
    color: colors.primary,
    fontWeight: font.weight.bold,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  balanceValue: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: colors.white,
    letterSpacing: -0.5,
  },
  balanceDesc: {
    fontSize: font.size.xs,
    color: 'rgba(255,255,255,0.76)',
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  approvalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  approvalEyebrow: {
    fontSize: font.size.xs,
    color: colors.danger,
    fontWeight: font.weight.bold,
  },
  approvalBadge: {
    fontSize: font.size.xs,
    color: colors.primary,
    fontWeight: font.weight.semibold,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  approvalTitle: {
    fontSize: font.size.md,
    color: colors.gray900,
    fontWeight: font.weight.bold,
    lineHeight: 22,
  },
  approvalSub: {
    fontSize: font.size.xs,
    color: colors.gray400,
    marginTop: 2,
  },
  approvalDesc: {
    fontSize: font.size.sm,
    color: colors.gray500,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  approvalPrimaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalPrimaryText: {
    color: colors.white,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  approvalSecondaryButton: {
    minHeight: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalSecondaryText: {
    color: colors.gray700,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  buttonDisabled: { opacity: 0.5 },
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
  sectionHint: {
    fontSize: font.size.xs,
    color: colors.gray500,
    lineHeight: 17,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
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
    fontSize: font.size.lg,
    color: colors.gray900,
    fontWeight: font.weight.bold,
  },
  amountSub: {
    fontSize: font.size.xs,
    color: colors.gray400,
    marginTop: 1,
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
  pendingApproval: {
    fontSize: font.size.sm,
    color: colors.danger,
    fontWeight: font.weight.semibold,
    marginTop: spacing.xs,
  },
  refundReviewBadge: {
    fontSize: font.size.sm,
    color: colors.warning,
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
    minWidth: 132,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.lg,
  },
  fabText: { color: colors.white, fontSize: font.size.sm, fontWeight: font.weight.bold },
});
