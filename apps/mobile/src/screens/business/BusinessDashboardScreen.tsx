import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ApiError } from '../../api/client';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { useAuthStore } from '../../store/auth';
import { ErrorView } from '../../components/ErrorView';
import { BalanceCardSkeleton, BusinessSummaryRowSkeleton, EscrowCardSkeleton } from '../../components/Skeleton';
import { formatKrwFromRlusd, formatRlusd } from '../../utils/money';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { EscrowRecord, EscrowEntry, PaymentRequest, RefundReviewRequest } from '@prepaid-shield/shared-types';
import type { BusinessTabProps } from '../../navigation/types';

type StatusFilter = 'all' | 'active' | 'completed' | 'cancelled' | 'cancel_failed';
const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '진행중' },
  { key: 'completed', label: '완료' },
  { key: 'cancelled', label: '취소됨' },
  { key: 'cancel_failed', label: '취소 재시도 필요' },
];

const MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES = new Set([
  'platform_review',
  'merchant_response_requested',
  'merchant_responded',
  'merchant_review',
  'merchant_disputed',
  'platform_investigation',
  'auto_approved',
  'platform_approved',
  'refunded',
  'rejected',
]);
const REFUND_REVIEW_ACTION_REQUIRED_STATUSES = new Set([
  'merchant_response_requested',
  'merchant_review',
]);
const REFUND_REVIEW_MONITORING_STATUSES = new Set([
  'platform_review',
  'merchant_responded',
  'merchant_disputed',
  'platform_investigation',
]);
const REFUND_REVIEW_STATUS_KO: Record<string, string> = {
  platform_review: 'TrustPay 확인 중',
  merchant_response_requested: '사업자 답변 대기',
  merchant_responded: '사업자 답변 완료',
  merchant_review: '사업자 답변 대기',
  merchant_disputed: '사업자 이의제기',
  platform_investigation: 'TrustPay 추가 확인 중',
  auto_approved: '무응답 자동 승인',
  platform_approved: 'TrustPay 환불 승인',
  refunded: '환불 완료',
  rejected: '환불 검토 거절',
};

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

function getEscrowSortTime(escrow: EscrowWithConsumer): number {
  return Math.max(
    new Date(escrow.updatedAt ?? 0).getTime() || 0,
    new Date(escrow.createdAt ?? 0).getTime() || 0,
  );
}

export function BusinessDashboardScreen({ navigation }: BusinessTabProps<'Dashboard'>) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [pendingCancelRequest, setPendingCancelRequest] = useState<PaymentRequest | null>(null);

  const { data: dashboard, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['businessDashboard', userId],
    queryFn: () => api.getBusinessDashboard(userId!),
    enabled: !!userId,
    retry: 2,
    staleTime: 0,
    refetchInterval: 5000,
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

  const cancelPaymentRequestMutation = useMutation({
    mutationFn: (requestId: string) => api.cancelPaymentRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessDashboard'] });
      showSuccessToast('QR 결제 취소', '손님 승인 전 결제 QR을 취소했습니다.');
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      showErrorToast('QR 취소 실패', apiErr.userMessage ?? err.message);
    },
  });

  const copyPaymentCode = useCallback(async (request: PaymentRequest) => {
    await Clipboard.setStringAsync(request.code);
    showSuccessToast('결제 코드 복사', `${request.code}를 복사했습니다.`);
  }, []);

  const confirmCancelPaymentRequest = useCallback((request: PaymentRequest) => {
    setPendingCancelRequest(request);
  }, []);

  const cancelPendingPaymentRequest = useCallback(() => {
    if (!pendingCancelRequest) return;
    cancelPaymentRequestMutation.mutate(pendingCancelRequest.id);
    setPendingCancelRequest(null);
  }, [cancelPaymentRequestMutation, pendingCancelRequest]);

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
    return [...result].sort((a, b) => getEscrowSortTime(b) - getEscrowSortTime(a));
  }, [dashboard?.escrows, statusFilter, searchQuery]);

  const sectionLabel = searchQuery.trim()
    ? '검색 결과'
    : statusFilter === 'all'
      ? '보호 결제'
      : `${FILTER_OPTIONS.find((option) => option.key === statusFilter)?.label ?? '진행중'} 보호 결제`;
  const pendingPaymentRequests = (dashboard?.pendingPaymentRequests ?? []) as PaymentRequest[];
  const refundReviewItems = ((dashboard?.escrows ?? []) as EscrowWithConsumer[])
    .flatMap((escrow) => (escrow.refundReviewRequests ?? [])
      .filter((request: RefundReviewRequest) => MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES.has(request.status))
      .map((request: RefundReviewRequest) => ({ escrow, request })))
    .sort((a, b) => new Date(b.request.requestedAt).getTime() - new Date(a.request.requestedAt).getTime());
  const actionRequiredRefundReviewItems = refundReviewItems.filter(({ request }) => REFUND_REVIEW_ACTION_REQUIRED_STATUSES.has(request.status));
  const monitoringRefundReviewItems = refundReviewItems.filter(({ request }) => REFUND_REVIEW_MONITORING_STATUSES.has(request.status));
  const latestActionRequiredRefundReviewItem = actionRequiredRefundReviewItems[0];
  const summary = dashboard?.summary;
  const receivedAmount = summary?.receivedAmount ?? dashboard?.totalReceived ?? 0;
  const protectedPendingAmount = summary?.protectedPendingAmount ?? dashboard?.totalPending ?? 0;
  const pendingApprovalAmount = summary?.pendingApprovalAmount ?? pendingPaymentRequests.reduce(
    (sum, request) => sum + Number(request.paymentAmount ?? request.totalAmount ?? 0),
    0,
  );
  const refundActionRequiredCount = summary?.refundActionRequiredCount ?? actionRequiredRefundReviewItems.length;
  const refundMonitoringCount = summary?.refundMonitoringCount ?? monitoringRefundReviewItems.length;
  const dueSettlementCount = summary?.dueSettlementCount ?? 0;
  const hasDashboardWork = refundActionRequiredCount > 0 || pendingPaymentRequests.length > 0 || dueSettlementCount > 0;
  const emptyTitle = searchQuery.trim()
    ? '검색 결과가 없습니다'
    : statusFilter === 'active'
      ? '진행중 보호 결제가 없습니다'
      : `${FILTER_OPTIONS.find((option) => option.key === statusFilter)?.label ?? '선택한'} 보호 결제가 없습니다`;
  const emptyDesc = searchQuery.trim()
    ? '다른 고객 이름으로 다시 검색해보세요'
    : statusFilter === 'active'
      ? '손님이 보호 결제를 승인하면 여기에 표시됩니다'
      : '다른 필터를 선택해 보호 결제를 확인해보세요';

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
            <View style={styles.workCard}>
              <View style={styles.workHeader}>
                <View>
                  <Text style={styles.workEyebrow}>사업자 홈</Text>
                  <Text style={styles.workTitle}>오늘 처리할 일</Text>
                </View>
                <Text style={styles.workCount}>{hasDashboardWork ? `${refundActionRequiredCount + pendingPaymentRequests.length + dueSettlementCount}건` : '0건'}</Text>
              </View>
              {hasDashboardWork ? (
                <View style={styles.workItems}>
                  {refundActionRequiredCount > 0 && latestActionRequiredRefundReviewItem && (
                    <TouchableOpacity
                      accessibilityLabel="환불 요청 확인"
                      accessibilityRole="button"
                      activeOpacity={0.82}
                      onPress={() => navigation.navigate('BusinessEscrowDetail', { id: latestActionRequiredRefundReviewItem.escrow.id })}
                      style={styles.workItem}
                    >
                      <View style={[styles.workIcon, styles.workIconWarning]}>
                        <Text style={styles.workIconText}>!</Text>
                      </View>
                      <View style={styles.workCopy}>
                        <Text style={styles.workItemTitle}>환불 답변 필요</Text>
                        <Text style={styles.workItemDesc} numberOfLines={1}>
                          {latestActionRequiredRefundReviewItem.escrow.consumer?.name ?? '손님'} · {formatKrwFromRlusd(latestActionRequiredRefundReviewItem.request.refundableAmount)}
                        </Text>
                      </View>
                      <Text style={styles.workItemCount}>{refundActionRequiredCount}건</Text>
                    </TouchableOpacity>
                  )}
                  {pendingPaymentRequests.length > 0 && (
                    <View style={styles.workItem}>
                      <View style={[styles.workIcon, styles.workIconPrimary]}>
                        <Text style={styles.workIconText}>QR</Text>
                      </View>
                      <View style={styles.workCopy}>
                        <Text style={styles.workItemTitle}>승인 대기 QR</Text>
                        <Text style={styles.workItemDesc}>손님 계좌 승인 전입니다</Text>
                      </View>
                      <Text style={styles.workItemCount}>{pendingPaymentRequests.length}건</Text>
                    </View>
                  )}
                  {dueSettlementCount > 0 && (
                    <View style={styles.workItem}>
                      <View style={[styles.workIcon, styles.workIconSuccess]}>
                        <Text style={styles.workIconText}>₩</Text>
                      </View>
                      <View style={styles.workCopy}>
                        <Text style={styles.workItemTitle}>이번 달 정산 예정</Text>
                        <Text style={styles.workItemDesc}>{formatKrwFromRlusd(summary?.dueSettlementAmount ?? 0)} 자동 처리 대상</Text>
                      </View>
                      <Text style={styles.workItemCount}>{dueSettlementCount}건</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.workEmpty}>지금 바로 처리할 환불 답변이나 승인 대기 QR이 없습니다.</Text>
              )}
              {refundMonitoringCount > 0 && (
                <Text style={styles.workFootnote}>TrustPay 확인 중인 환불 검토 {refundMonitoringCount}건은 상태만 추적합니다.</Text>
              )}
            </View>

            {/* 잔액 카드 */}
            {balanceLoading ? (
              <View style={styles.balanceCard}>
                <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
              </View>
            ) : balanceError ? (
              <View style={[styles.balanceCard, styles.balanceCardError]}>
                <Text style={styles.balanceLabel}>원장 잔액</Text>
                <Text style={styles.balanceValue}>조회 실패</Text>
              </View>
            ) : balanceData ? (
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>원장 잔액</Text>
                <Text style={styles.balanceValue}>
                  수령 가능 {formatKrwFromRlusd(balanceData.balance)}
                </Text>
                <Text style={styles.balanceSub}>{formatRlusd(balanceData.balance)}</Text>
                <Text style={styles.balanceAddr}>
                  원장 주소 {balanceData.xrplAddress.slice(0, 8)}...{balanceData.xrplAddress.slice(-6)}
                </Text>
              </View>
            ) : null}

            {/* 수령/대기 요약 */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {formatKrwFromRlusd(receivedAmount)}
                </Text>
                <Text style={styles.summarySub}>{formatRlusd(receivedAmount)}</Text>
                <Text style={styles.summaryLabel}>수령 완료</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {formatKrwFromRlusd(protectedPendingAmount)}
                </Text>
                <Text style={styles.summarySub}>{formatRlusd(protectedPendingAmount)}</Text>
                <Text style={styles.summaryLabel}>보호 대기</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {formatKrwFromRlusd(pendingApprovalAmount)}
                </Text>
                <Text style={styles.summarySub}>{formatRlusd(pendingApprovalAmount)}</Text>
                <Text style={styles.summaryLabel}>승인 대기</Text>
              </View>
            </View>

            {latestActionRequiredRefundReviewItem && (
              <View style={styles.refundReviewCard}>
                <View style={styles.refundReviewHeader}>
                  <View>
                    <Text style={styles.refundReviewEyebrow}>환불 답변 필요</Text>
                    <Text style={styles.refundReviewTitle}>{refundActionRequiredCount}건</Text>
                    <Text style={styles.refundReviewStatus}>{REFUND_REVIEW_STATUS_KO[latestActionRequiredRefundReviewItem.request.status] ?? latestActionRequiredRefundReviewItem.request.status}</Text>
                  </View>
                  <TouchableOpacity
                    accessibilityLabel="환불 요청 확인"
                    accessibilityRole="button"
                    style={styles.refundReviewAction}
                    onPress={() => navigation.navigate('BusinessEscrowDetail', { id: latestActionRequiredRefundReviewItem.escrow.id })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.refundReviewActionText}>요청 확인</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.refundReviewSummary}>
                  {latestActionRequiredRefundReviewItem.escrow.consumer?.name ?? '손님'} · 환불 가능 {formatKrwFromRlusd(latestActionRequiredRefundReviewItem.request.refundableAmount)}
                </Text>
                {!!latestActionRequiredRefundReviewItem.request.merchantNotice && (
                  <Text style={styles.refundReviewReason} numberOfLines={2}>{latestActionRequiredRefundReviewItem.request.merchantNotice}</Text>
                )}
              </View>
            )}

            {pendingPaymentRequests.length > 0 && (
              <View style={styles.pendingPaymentBox}>
                <View style={styles.pendingPaymentHeader}>
                  <View>
                    <Text style={styles.pendingPaymentTitle}>승인 대기 QR</Text>
                    <Text style={styles.pendingPaymentDesc}>손님이 계좌 승인하면 보호 결제로 이동합니다.</Text>
                  </View>
                  <View style={styles.pendingPaymentTotalBlock}>
                    <Text style={styles.pendingPaymentTotalLabel}>승인 대기 총액</Text>
                    <Text style={styles.pendingPaymentTotalValue}>{formatKrwFromRlusd(pendingApprovalAmount)}</Text>
                  </View>
                </View>
                {pendingPaymentRequests.map((request) => (
                  <View key={request.id} style={styles.pendingPaymentCard}>
                    <View style={styles.pendingPaymentCodeBlock}>
                      <Text style={styles.pendingPaymentCode}>{request.code}</Text>
                      <Text style={styles.pendingPaymentMeta}>손님 승인 전</Text>
                    </View>
                    <View style={styles.pendingPaymentAmountBlock}>
                      <Text style={styles.pendingPaymentAmount}>
                        결제 {formatKrwFromRlusd(request.paymentAmount ?? request.totalAmount)} · 보호 {formatKrwFromRlusd(request.totalAmount)}
                      </Text>
                      <Text style={styles.pendingPaymentAmountSub}>{formatRlusd(request.totalAmount)}</Text>
                      <View style={styles.pendingPaymentActions}>
                        <TouchableOpacity
                          accessibilityLabel={`결제 코드 ${request.code} 복사`}
                          accessibilityRole="button"
                          activeOpacity={0.75}
                          onPress={() => copyPaymentCode(request)}
                          style={styles.pendingPaymentActionButton}
                        >
                          <Text style={styles.pendingPaymentActionText}>코드 복사</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityLabel={`결제 QR ${request.code} 취소`}
                          accessibilityRole="button"
                          activeOpacity={0.75}
                          onPress={() => confirmCancelPaymentRequest(request)}
                          style={[styles.pendingPaymentActionButton, styles.pendingPaymentCancelButton]}
                        >
                          <Text style={[styles.pendingPaymentActionText, styles.pendingPaymentCancelText]}>QR 취소</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              accessibilityLabel="새 보호 결제 만들기"
              accessibilityRole="button"
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
                accessibilityLabel="소비자 이름 검색"
                style={styles.searchInput}
                placeholder="소비자 이름 검색…"
                placeholderTextColor={colors.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  accessibilityLabel="검색어 지우기"
                  accessibilityRole="button"
                  onPress={() => setSearchQuery('')}
                  style={styles.clearBtn}
                >
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
              {(summary?.autoSettledCount ?? 0) > 0
                ? `이번 조회에서 ${summary?.autoSettledCount}건이 자동 정산되었습니다`
                : filteredEscrows.some((e) => e.escrowType === 'prepaid')
                  ? '금액권은 손님 승인 후 실제 이용분만 보호 잔액에서 정산됩니다'
                  : '정산 조건이 된 월차는 서버에서 자동 처리됩니다'}
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
          const rawProgressPct = isPrepaid
            ? Number(item.totalAmount) > 0 ? ((prepaidAmounts?.usedAmount ?? 0) / Number(item.totalAmount)) * 100 : 0
            : totalEntries > 0 ? (releasedCount / totalEntries) * 100 : 0;
          const progressPct = Math.max(0, Math.min(rawProgressPct, 100));
          const latestRefundReview = (item.refundReviewRequests ?? [])
            .filter((request: RefundReviewRequest) => MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES.has(request.status))
            .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];
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
                {latestRefundReview && (
                  <Text style={styles.refundReviewBadge}>
                    환불 검토 중: {REFUND_REVIEW_STATUS_KO[latestRefundReview.status] ?? latestRefundReview.status}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyDesc}>{emptyDesc}</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
      <Modal
        visible={!!pendingCancelRequest}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingCancelRequest(null)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>QR 결제 취소</Text>
            <Text style={styles.confirmMessage}>
              {pendingCancelRequest?.code ?? ''} 결제 QR을 취소할까요? 손님이 아직 승인하지 않은 QR만 취소됩니다.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                accessibilityLabel="QR 취소하지 않기"
                accessibilityRole="button"
                activeOpacity={0.8}
                onPress={() => setPendingCancelRequest(null)}
                style={[styles.confirmButton, styles.confirmKeepButton]}
              >
                <Text style={styles.confirmKeepText}>유지</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="QR 취소하기"
                accessibilityRole="button"
                activeOpacity={0.8}
                onPress={cancelPendingPaymentRequest}
                style={[styles.confirmButton, styles.confirmCancelButton]}
              >
                <Text style={styles.confirmCancelText}>취소하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  workCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  workHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  workEyebrow: {
    color: colors.gray500,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    marginBottom: 2,
  },
  workTitle: {
    color: colors.gray900,
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
  },
  workCount: {
    color: colors.primary,
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
  },
  workItems: { gap: spacing.sm },
  workItem: {
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  workIcon: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  workIconWarning: { backgroundColor: colors.warningLight },
  workIconPrimary: { backgroundColor: colors.primaryLight },
  workIconSuccess: { backgroundColor: colors.successLight },
  workIconText: {
    color: colors.primary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
  },
  workCopy: { flex: 1 },
  workItemTitle: {
    color: colors.gray900,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
  workItemDesc: {
    color: colors.gray500,
    fontSize: font.size.xs,
    marginTop: 2,
  },
  workItemCount: {
    color: colors.gray900,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
  workEmpty: {
    color: colors.gray500,
    fontSize: font.size.sm,
    lineHeight: 20,
  },
  workFootnote: {
    color: colors.gray500,
    fontSize: font.size.xs,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
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
  balanceSub: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    marginBottom: spacing.xs,
  },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadow.sm,
  },
  summaryValue: {
    fontSize: font.size.md,
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
  refundReviewStatus: { color: colors.gray700, fontSize: font.size.sm, marginTop: 2 },
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
  pendingPaymentBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
    padding: spacing.lg,
  },
  pendingPaymentHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  pendingPaymentTitle: {
    color: colors.gray900,
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
  },
  pendingPaymentDesc: {
    color: colors.gray600,
    fontSize: font.size.sm,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  pendingPaymentTotalBlock: {
    alignItems: 'flex-end',
  },
  pendingPaymentTotalLabel: {
    color: colors.gray500,
    fontSize: font.size.xs,
    marginBottom: 2,
  },
  pendingPaymentTotalValue: {
    color: colors.primary,
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
  },
  pendingPaymentCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pendingPaymentCodeBlock: { flexShrink: 0 },
  pendingPaymentCode: {
    color: colors.primary,
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
  },
  pendingPaymentMeta: {
    color: colors.gray500,
    fontSize: font.size.xs,
    marginTop: 2,
  },
  pendingPaymentAmountBlock: { alignItems: 'flex-end', flex: 1 },
  pendingPaymentAmount: {
    color: colors.gray900,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    textAlign: 'right',
  },
  pendingPaymentAmountSub: {
    color: colors.gray400,
    fontSize: font.size.xs,
    marginTop: 2,
  },
  pendingPaymentActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  pendingPaymentActionButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pendingPaymentCancelButton: {
    backgroundColor: colors.gray100,
  },
  pendingPaymentActionText: {
    color: colors.primary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
  },
  pendingPaymentCancelText: {
    color: colors.gray600,
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
  refundReviewBadge: {
    color: colors.warning,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    marginTop: spacing.sm,
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
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray700,
    marginBottom: spacing.xs,
  },
  emptyDesc: { fontSize: font.size.sm, color: colors.gray400, textAlign: 'center' },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.46)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  confirmCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.lg,
  },
  confirmTitle: {
    color: colors.gray900,
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    marginBottom: spacing.sm,
  },
  confirmMessage: {
    color: colors.gray600,
    fontSize: font.size.md,
    lineHeight: 22,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  confirmButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    paddingVertical: spacing.md,
  },
  confirmKeepButton: { backgroundColor: colors.gray100 },
  confirmCancelButton: { backgroundColor: colors.danger },
  confirmKeepText: {
    color: colors.gray700,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  confirmCancelText: {
    color: colors.white,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
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
