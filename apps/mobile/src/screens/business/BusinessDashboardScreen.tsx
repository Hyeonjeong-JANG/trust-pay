import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ApiError } from '../../api/client';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { useAuthStore } from '../../store/auth';
import { ErrorView } from '../../components/ErrorView';
import { BalanceCardSkeleton, BusinessSummaryRowSkeleton, EscrowCardSkeleton } from '../../components/Skeleton';
import { formatKrwFromRlusd, formatRlusd } from '../../utils/money';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { EscrowRecord, EscrowEntry, RefundReviewRequest } from '@prepaid-shield/shared-types';
import type { BusinessTabProps } from '../../navigation/types';

type StatusFilter = 'all' | 'active' | 'completed' | 'cancelled';
const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '진행중' },
  { key: 'completed', label: '완료' },
  { key: 'cancelled', label: '취소됨' },
];

const MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES = new Set([
  'merchant_response_requested',
  'merchant_responded',
  'merchant_disputed',
  'platform_investigation',
  'auto_approved',
  'platform_approved',
  'refunded',
  'rejected',
]);

type EscrowWithConsumer = EscrowRecord & { consumer?: { id: string; name: string } };

function sumEntryAmounts(entries: EscrowEntry[], status: EscrowEntry['status']): number {
  return entries
    .filter((entry) => entry.status === status)
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
}

function getPrepaidAmounts(escrow: EscrowWithConsumer) {
  const totalAmount = Number(escrow.totalAmount);
  const settledChargeAmount = escrow.chargeRequests
    ?.filter((request) => request.status === 'settled')
    .reduce((sum, request) => sum + Number(request.amount), 0) ?? 0;
  const releasedEntryAmount = sumEntryAmounts(escrow.entries ?? [], 'released');
  const refundedEntryAmount = sumEntryAmounts(escrow.entries ?? [], 'refunded');
  const usedAmount = settledChargeAmount > 0 ? settledChargeAmount : releasedEntryAmount;
  return {
    usedAmount,
    remainingAmount: Math.max(totalAmount - usedAmount - refundedEntryAmount, 0),
  };
}

export function BusinessDashboardScreen({ navigation }: BusinessTabProps<'Dashboard'>) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const autoFinishedKeysRef = useRef<Set<string>>(new Set());

  const { data: dashboard, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['businessDashboard', userId],
    queryFn: () => api.getBusinessDashboard(userId!),
    enabled: !!userId,
    retry: 2,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const { data: balanceData, isLoading: balanceLoading, isError: balanceError, refetch: refetchBalance } = useQuery({
    queryKey: ['balance', userId],
    queryFn: () => api.getBalance(userId!, 'business'),
    enabled: !!userId,
    retry: 1,
  });

  const onRefresh = useCallback(() => {
    refetch();
    refetchBalance();
  }, [refetch, refetchBalance]);

  useEffect(() => {
    const escrows = (dashboard?.escrows ?? []) as EscrowWithConsumer[];
    const nowRipple = Math.floor(Date.now() / 1000) - 946684800;
    const eligibleEntries = escrows.flatMap((escrow) => {
      if (escrow.status !== 'active' || escrow.escrowType === 'prepaid') return [];
      return (escrow.entries ?? [])
        .filter((entry) => entry.status === 'pending' && entry.finishAfter <= nowRipple)
        .map((entry) => ({ escrowId: escrow.id, month: entry.month, key: `${escrow.id}:${entry.month}` }));
    });
    const pendingAutoFinishes = eligibleEntries.filter((entry) => !autoFinishedKeysRef.current.has(entry.key));
    if (pendingAutoFinishes.length === 0) return;

    pendingAutoFinishes.forEach((entry) => autoFinishedKeysRef.current.add(entry.key));
    Promise.all(pendingAutoFinishes.map((entry) => api.finishEscrow(entry.escrowId, entry.month)))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['businessDashboard'] });
        queryClient.invalidateQueries({ queryKey: ['balance'] });
        showSuccessToast('자동 정산 완료', `${pendingAutoFinishes.length}건이 조건 충족으로 자동 수령되었습니다.`);
      })
      .catch((err: Error) => {
        const apiErr = err as ApiError;
        showErrorToast('자동 정산 실패', apiErr.userMessage ?? err.message);
      });
  }, [dashboard?.escrows, queryClient]);

  const filteredEscrows = useMemo(() => {
    const all = (dashboard?.escrows ?? []) as EscrowWithConsumer[];
    let result = all;
    if (statusFilter !== 'all') {
      result = result.filter((e) => e.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((e) =>
        (e.consumer?.name ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [dashboard?.escrows, statusFilter, searchQuery]);

  const sectionLabel = searchQuery.trim()
    ? '검색 결과'
    : statusFilter === 'all'
      ? '에스크로'
      : `${FILTER_OPTIONS.find((option) => option.key === statusFilter)?.label ?? '진행중'} 에스크로`;
  const refundReviewItems = ((dashboard?.escrows ?? []) as EscrowWithConsumer[])
    .flatMap((escrow) => (escrow.refundReviewRequests ?? [])
      .filter((request: RefundReviewRequest) => MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES.has(request.status))
      .map((request: RefundReviewRequest) => ({ escrow, request })))
    .sort((a, b) => new Date(b.request.requestedAt).getTime() - new Date(a.request.requestedAt).getTime());
  const latestRefundReviewItem = refundReviewItems[0];

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.listContent}>
          <BalanceCardSkeleton />
          <BusinessSummaryRowSkeleton />
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
        keyExtractor={(item: EscrowRecord) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
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
                <Text style={styles.balanceLabel}>TrustPay 정산 원장</Text>
                <Text style={styles.balanceValue}>조회 실패</Text>
              </View>
            ) : balanceData ? (
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>TrustPay 정산 원장</Text>
                <Text style={styles.balanceValue}>
                  수령 가능 {Number(balanceData.balance).toLocaleString()} RLUSD
                </Text>
                <Text style={styles.balanceAddr}>
                  원장 주소 {balanceData.xrplAddress.slice(0, 8)}...{balanceData.xrplAddress.slice(-6)}
                </Text>
              </View>
            ) : null}

            {/* 수령/대기 요약 */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryIcon}>✅</Text>
                <Text style={styles.summaryValue}>
                  {formatKrwFromRlusd(dashboard?.totalReceived ?? 0)}
                </Text>
                <Text style={styles.summarySub}>{formatRlusd(dashboard?.totalReceived ?? 0)}</Text>
                <Text style={styles.summaryLabel}>수령액</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryIcon}>⏳</Text>
                <Text style={styles.summaryValue}>
                  {formatKrwFromRlusd(dashboard?.totalPending ?? 0)}
                </Text>
                <Text style={styles.summarySub}>{formatRlusd(dashboard?.totalPending ?? 0)}</Text>
                <Text style={styles.summaryLabel}>대기액</Text>
              </View>
            </View>

            {latestRefundReviewItem && (
              <View style={styles.refundReviewCard}>
                <View style={styles.refundReviewHeader}>
                  <View>
                    <Text style={styles.refundReviewEyebrow}>환불 검토 요청</Text>
                    <Text style={styles.refundReviewTitle}>{refundReviewItems.length}건 대기</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.refundReviewAction}
                    onPress={() => navigation.navigate('BusinessEscrowDetail', { id: latestRefundReviewItem.escrow.id })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.refundReviewActionText}>요청 확인</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.refundReviewSummary}>
                  {latestRefundReviewItem.escrow.consumer?.name ?? '손님'} · 환불 가능 {formatKrwFromRlusd(latestRefundReviewItem.request.refundableAmount)}
                </Text>
                {!!latestRefundReviewItem.request.merchantNotice && (
                  <Text style={styles.refundReviewReason} numberOfLines={2}>{latestRefundReviewItem.request.merchantNotice}</Text>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.createPaymentCard}
              onPress={() => navigation.navigate('BusinessCreatePayment')}
              activeOpacity={0.85}
            >
              <View style={styles.createPaymentIcon}>
                <Text style={styles.createPaymentIconText}>+</Text>
              </View>
              <View style={styles.createPaymentCopy}>
                <Text style={styles.createPaymentTitle}>새 보호 결제 만들기</Text>
                <Text style={styles.createPaymentDesc}>월정액 또는 기간 금액권 QR을 손님에게 보여주세요.</Text>
              </View>
              <Text style={styles.createPaymentAction}>QR 만들기</Text>
            </TouchableOpacity>

            {/* 검색 + 필터 */}
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="소비자 이름 검색..."
                placeholderTextColor={colors.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {FILTER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.filterChip, statusFilter === opt.key && styles.filterChipActive]}
                  onPress={() => setStatusFilter(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, statusFilter === opt.key && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.settlementHint}>
              {filteredEscrows.some((e) => e.escrowType === 'prepaid')
                ? '이미 보호 원장에 잠긴 금액권에서 실제 사용금액 차감 요청을 보냅니다. 소비자 승인 후 잔액에서 정산됩니다'
                : 'EscrowFinish로 수령 가능한 월차만 정산됩니다'}
            </Text>
            <Text style={styles.sectionTitle}>
              {sectionLabel} ({filteredEscrows.length}건)
            </Text>
          </>
        }
        renderItem={({ item }: { item: EscrowWithConsumer }) => {
          const isPrepaid = item.escrowType === 'prepaid';
          const pendingEntries = item.entries?.filter((e: EscrowEntry) => e.status === 'pending') ?? [];
          const releasedCount = (item.entries?.length ?? 0) - pendingEntries.length;
          const totalEntries = item.entries?.length || item.months;
          const prepaidAmounts = isPrepaid ? getPrepaidAmounts(item) : null;
          const progressPct = isPrepaid
            ? Number(item.totalAmount) > 0 ? ((prepaidAmounts?.usedAmount ?? 0) / Number(item.totalAmount)) * 100 : 0
            : totalEntries > 0 ? (releasedCount / totalEntries) * 100 : 0;
          return (
            <View style={styles.card}>
              <TouchableOpacity
                onPress={() => navigation.navigate('BusinessEscrowDetail', { id: item.id })}
                activeOpacity={0.86}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardAvatar}>
                    <Text style={styles.cardAvatarText}>
                      {(item.consumer?.name ?? '소')[0]}
                    </Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{item.consumer?.name ?? '소비자'}</Text>
                    <Text style={styles.cardSub}>
                      {isPrepaid
                        ? `사용 ${formatKrwFromRlusd(prepaidAmounts?.usedAmount ?? 0)} · 잔액 ${formatKrwFromRlusd(prepaidAmounts?.remainingAmount ?? 0)}`
                        : `${formatKrwFromRlusd(item.monthlyAmount)}/월 · ${pendingEntries.length}건 대기`}
                    </Text>
                    <Text style={styles.cardSubRlusd}>
                      {isPrepaid
                        ? `${formatRlusd(prepaidAmounts?.usedAmount ?? 0)} 사용 · ${formatRlusd(prepaidAmounts?.remainingAmount ?? 0)} 잔액`
                        : formatRlusd(item.monthlyAmount)}
                    </Text>
                  </View>
                  <View style={styles.cardAmountBlock}>
                    <Text style={styles.cardAmount}>{formatKrwFromRlusd(item.totalAmount)}</Text>
                    <Text style={styles.cardAmountSub}>{formatRlusd(item.totalAmount)}</Text>
                  </View>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>활성 에스크로가 없습니다</Text>
            <Text style={styles.emptyDesc}>소비자가 에스크로를 생성하면 여기에 표시됩니다</Text>
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
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadow.sm,
  },
  summaryIcon: { fontSize: 20, marginBottom: spacing.xs },
  summaryValue: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.gray900,
  },
  summarySub: { fontSize: font.size.xs, color: colors.gray400, marginTop: 2 },
  summaryLabel: { fontSize: font.size.xs, color: colors.gray500, marginTop: spacing.xs },
  refundReviewCard: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
    padding: spacing.lg,
  },
  refundReviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  refundReviewEyebrow: {
    color: colors.warning,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    marginBottom: 2,
  },
  refundReviewTitle: {
    color: colors.gray900,
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
  },
  refundReviewAction: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  refundReviewActionText: { color: colors.warning, fontSize: font.size.sm, fontWeight: font.weight.bold },
  refundReviewSummary: {
    color: colors.gray800,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    marginTop: spacing.md,
  },
  refundReviewReason: {
    color: colors.gray600,
    fontSize: font.size.sm,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  createPaymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    ...shadow.sm,
  },
  createPaymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  createPaymentIconText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: font.weight.bold,
    lineHeight: 28,
  },
  createPaymentCopy: { flex: 1 },
  createPaymentTitle: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.gray900 },
  createPaymentDesc: { fontSize: font.size.xs, color: colors.gray500, marginTop: 2, lineHeight: 18 },
  createPaymentAction: { fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.primary },
  settlementHint: {
    fontSize: font.size.sm,
    color: colors.gray500,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray900,
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
    alignItems: 'center',
  },
  cardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardAvatarText: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.success,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.gray900 },
  cardSub: { fontSize: font.size.sm, color: colors.gray400, marginTop: 2 },
  cardSubRlusd: { fontSize: font.size.xs, color: colors.gray400, marginTop: 1 },
  cardAmountBlock: { alignItems: 'flex-end', marginLeft: spacing.sm },
  cardAmount: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.primary,
  },
  cardAmountSub: { fontSize: font.size.xs, color: colors.gray400, marginTop: 1 },
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
  releaseButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.5 },
  releaseButtonText: { color: colors.white, fontWeight: font.weight.semibold, fontSize: font.size.sm },
  releaseButtonSub: { color: 'rgba(255,255,255,0.75)', fontSize: font.size.xs, marginTop: 2 },
  autoSettlementHint: {
    backgroundColor: colors.successLight,
    color: colors.success,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    lineHeight: 20,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    overflow: 'hidden',
    textAlign: 'center',
  },
  chargeRequestBox: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.md,
  },
  menuBuilderBox: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  menuDraftRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  menuNameInput: { flex: 1 },
  menuAmountInput: { width: 128 },
  secondaryButton: {
    backgroundColor: colors.successLight,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.success, fontWeight: font.weight.semibold, fontSize: font.size.sm },
  addedMenuList: { gap: spacing.xs },
  addedMenuText: { fontSize: font.size.xs, color: colors.gray500 },
  manualChargeBox: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  manualChargeTitle: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.gray800,
  },
  manualChargeDesc: {
    fontSize: font.size.xs,
    color: colors.gray500,
    lineHeight: 18,
  },
  manualChargeInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    fontSize: font.size.md,
    color: colors.gray900,
  },
  manualChargeButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  manualChargeButtonText: { color: colors.white, fontWeight: font.weight.semibold, fontSize: font.size.sm },
  menuRequestList: {
    gap: spacing.sm,
  },
  menuRequestTitle: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.gray700,
  },
  dropdownButton: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: spacing.md,
  },
  dropdownLabel: { fontSize: font.size.xs, color: colors.gray400, marginBottom: 2 },
  dropdownValue: { fontSize: font.size.md, color: colors.gray900, fontWeight: font.weight.semibold },
  dropdownList: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  dropdownOptionText: { fontSize: font.size.sm, color: colors.gray800, fontWeight: font.weight.semibold },
  dropdownOptionSub: { fontSize: font.size.xs, color: colors.gray400, marginTop: 1 },
  menuRequestButtonSub: { color: 'rgba(255,255,255,0.75)', fontSize: font.size.xs, marginTop: 2 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray700,
    marginBottom: spacing.xs,
  },
  emptyDesc: { fontSize: font.size.sm, color: colors.gray400, textAlign: 'center' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: font.size.md,
    color: colors.gray800,
  },
  clearBtn: { padding: spacing.xs },
  clearBtnText: { fontSize: font.size.md, color: colors.gray400 },
  filterRow: { marginBottom: spacing.lg },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: font.size.sm,
    color: colors.gray500,
    fontWeight: font.weight.medium,
  },
  filterChipTextActive: {
    color: colors.white,
  },
});
