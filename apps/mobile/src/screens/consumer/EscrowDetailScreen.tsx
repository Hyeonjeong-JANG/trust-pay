import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ApiError } from '../../api/client';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { ApprovalAuthModal } from '../../components/ApprovalAuthModal';
import { ErrorView } from '../../components/ErrorView';
import { formatKrwFromRlusd, formatRlusd } from '../../utils/money';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { ChargeRequest, EscrowEntry, RefundReviewRequest } from '@prepaid-shield/shared-types';
import type { ScreenProps } from '../../navigation/types';
import type { EscrowRecord } from '@prepaid-shield/shared-types';
type EscrowWithRelations = EscrowRecord & { business?: { name: string }; consumer?: { name: string }; refundReviewRequests?: RefundReviewRequest[] };

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pending: { bg: colors.entry.pendingBg, text: colors.entry.pending },
  released: { bg: colors.entry.releasedBg, text: colors.entry.released },
  refunded: { bg: colors.entry.refundedBg, text: colors.entry.refunded },
  pending_approval: { bg: colors.entry.pendingBg, text: colors.entry.pending },
  settled: { bg: colors.entry.releasedBg, text: colors.entry.released },
  rejected: { bg: colors.entry.refundedBg, text: colors.entry.refunded },
  expired: { bg: colors.entry.refundedBg, text: colors.entry.refunded },
  active: { bg: colors.escrow.activeBg, text: colors.escrow.active },
  completed: { bg: colors.escrow.completedBg, text: colors.escrow.completed },
  cancelled: { bg: colors.escrow.cancelledBg, text: colors.escrow.cancelled },
};

const STATUS_KO: Record<string, string> = {
  pending: '대기',
  released: '릴리즈됨',
  refunded: '환불됨',
  pending_approval: '승인 대기',
  settled: '정산됨',
  rejected: '거절됨',
  expired: '만료됨',
  active: '진행중',
  completed: '완료',
  cancelled: '취소됨',
};

const REFUND_REVIEW_STATUS_KO: Record<string, string> = {
  merchant_review: '사업자 응답 대기',
  merchant_disputed: '사업자 이의제기',
  platform_investigation: 'TrustPay 조사 중',
  closure_suspected: '영업중단 의심 · TrustPay 조사',
  closure_confirmed: '폐업 확인 · TrustPay 검토',
  auto_approved: '무응답 자동 승인',
  platform_approved: 'TrustPay 환불 승인',
  refunded: '환불 완료',
  rejected: '환불 검토 거절',
};

function rippleTimeToDate(rippleTime: number): string {
  const RIPPLE_EPOCH = 946684800;
  return new Date((rippleTime + RIPPLE_EPOCH) * 1000).toLocaleDateString('ko-KR');
}

function isoToDate(value?: Date | string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString('ko-KR');
}

function getEntryUsageRange(entries: EscrowEntry[]): string | null {
  const starts = entries.map((entry) => entry.finishAfter).filter((value) => Number.isFinite(value));
  const ends = entries.map((entry) => entry.cancelAfter).filter((value) => Number.isFinite(value));
  if (starts.length === 0 || ends.length === 0) return null;
  return `${rippleTimeToDate(Math.min(...starts))} ~ ${rippleTimeToDate(Math.max(...ends))}`;
}

function getPrepaidUsageRange(escrow: EscrowWithRelations): string | null {
  const explicitStart = isoToDate(escrow.validFrom);
  const explicitEnd = isoToDate(escrow.validUntil);
  if (explicitStart && explicitEnd) return `${explicitStart} ~ ${explicitEnd}`;
  return getEntryUsageRange(escrow.entries);
}

function getLatestRefundReview(requests?: RefundReviewRequest[]): RefundReviewRequest | null {
  if (!requests?.length) return null;
  return [...requests].sort((a, b) => {
    const left = new Date(a.requestedAt).getTime();
    const right = new Date(b.requestedAt).getTime();
    return right - left;
  })[0];
}

function isChargeRequest(item: EscrowEntry | ChargeRequest): item is ChargeRequest {
  return 'menuName' in item;
}

function sumEntries(entries: EscrowEntry[], status: string): number {
  return entries
    .filter((entry) => entry.status === status)
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
}

export function EscrowDetailScreen({ route }: ScreenProps<'EscrowDetail'>) {
  const { id } = route.params;
  const queryClient = useQueryClient();
  const [chargeRequestToAuthenticate, setChargeRequestToAuthenticate] = useState<ChargeRequest | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['escrow', id],
    queryFn: () => api.getEscrow(id),
    retry: 2,
  });
  const escrow = data as EscrowWithRelations | undefined;

  const approveChargeMutation = useMutation({
    mutationFn: (requestId: string) => api.approveChargeRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escrow', id] });
      queryClient.invalidateQueries({ queryKey: ['consumerEscrows'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      showSuccessToast('차감 승인 완료', '소비자 승인 후 XRPL 정산이 실행되었습니다.');
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      showErrorToast('차감 승인 실패', apiErr.userMessage ?? err.message);
    },
  });

  const rejectChargeMutation = useMutation({
    mutationFn: (requestId: string) => api.rejectChargeRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escrow', id] });
      queryClient.invalidateQueries({ queryKey: ['consumerEscrows'] });
      showSuccessToast('차감 요청 거절', '사업자에게 거절 상태로 표시됩니다.');
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      showErrorToast('차감 거절 실패', apiErr.userMessage ?? err.message);
    },
  });

  const refundReviewMutation = useMutation({
    mutationFn: () => api.requestRefundReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escrow', id] });
      queryClient.invalidateQueries({ queryKey: ['consumerEscrows'] });
      showSuccessToast('환불 검토 요청 접수', '사업자 응답 기한과 폐업 여부를 확인한 뒤 환불 가능 금액을 안내합니다.');
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      showErrorToast('환불 검토 요청 실패', apiErr.userMessage ?? err.message);
    },
  });

  const handleRefundReviewRequest = () => {
    Alert.alert(
      '환불 검토 요청',
      '즉시 에스크로를 취소하지 않습니다. 실제 결제액, 보너스 혜택, 사용분, 약관상 공제액을 확인한 뒤 환불 가능 금액을 산정합니다.',
      [
        { text: '닫기', style: 'cancel' },
        {
          text: '요청 접수',
          onPress: () => refundReviewMutation.mutate(),
        },
      ],
    );
  };

  if (isLoading || (!escrow && !isError)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !escrow) {
    return <ErrorView error={error ?? new Error('데이터를 불러올 수 없습니다.')} onRetry={() => refetch()} />;
  }

  const released = escrow.entries.filter((e: EscrowEntry) => e.status === 'released').length;
  const pending = escrow.entries.filter((e: EscrowEntry) => e.status === 'pending').length;
  const refunded = escrow.entries.filter((e: EscrowEntry) => e.status === 'refunded').length;
  const isPrepaid = escrow.escrowType === 'prepaid';
  const pendingChargeRequests = escrow.chargeRequests?.filter((request) => request.status === 'pending_approval') ?? [];
  const chargeHistory = escrow.chargeRequests?.filter((request) => request.status !== 'pending_approval') ?? [];
  const latestRefundReview = getLatestRefundReview(escrow.refundReviewRequests);
  const totalEntries = escrow.entries.length || escrow.months;
  const escrowStyle = STATUS_STYLE[escrow.status] ?? STATUS_STYLE.cancelled;
  const usageRange = isPrepaid ? getPrepaidUsageRange(escrow) : getEntryUsageRange(escrow.entries);
  const usageRangeLabel = isPrepaid ? '사용기한' : '이용기간';
  const releasedAmount = sumEntries(escrow.entries, 'released');
  const refundedAmount = sumEntries(escrow.entries, 'refunded');
  const settledChargeRequests = chargeHistory.filter((request) => request.status === 'settled');
  const settledChargeAmount = settledChargeRequests.reduce((sum, request) => sum + Number(request.amount), 0);
  const settledChargeCount = settledChargeRequests.length;
  const prepaidUsedAmount = isPrepaid
    ? settledChargeAmount > 0
      ? settledChargeAmount
      : escrow.status === 'cancelled'
        ? releasedAmount
        : 0
    : releasedAmount;
  const prepaidRemainingAmount = Math.max(Number(escrow.totalAmount) - prepaidUsedAmount - refundedAmount, 0);
  const progressPct = isPrepaid
    ? Number(escrow.totalAmount) > 0 ? (prepaidUsedAmount / Number(escrow.totalAmount)) * 100 : 0
    : totalEntries > 0 ? (released / totalEntries) * 100 : 0;
  const progressText = isPrepaid
    ? escrow.status === 'cancelled'
      ? `사용 ${formatKrwFromRlusd(prepaidUsedAmount)} · 환불 ${formatKrwFromRlusd(refundedAmount)}`
      : `사용 ${formatKrwFromRlusd(prepaidUsedAmount)} · 잔액 ${formatKrwFromRlusd(prepaidRemainingAmount)} · 차감 ${settledChargeCount}건`
    : `${released}개월 정산 완료 · ${pending}개월 예정${refunded > 0 ? ` · ${refunded}개월 환불` : ''}`;
  const sectionTitle = isPrepaid
    ? '차감 내역'
    : '월별 내역';
  const listData: Array<EscrowEntry | ChargeRequest> = isPrepaid ? chargeHistory : escrow.entries;

  return (
    <View style={styles.container}>
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.ledgerLabel}>XRPL 원장 상태</Text>
              <View style={styles.summaryTop}>
                <Text style={styles.businessName}>{escrow.business?.name ?? '사업자'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: escrowStyle.bg }]}>
                  <Text style={[styles.statusText, { color: escrowStyle.text }]}>
                    {STATUS_KO[escrow.status] ?? escrow.status}
                  </Text>
                </View>
              </View>

              <View style={styles.amountRow}>
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>총액</Text>
                  <Text style={styles.amountValue}>{formatKrwFromRlusd(escrow.totalAmount)}</Text>
                  <Text style={styles.amountUnit}>{formatRlusd(escrow.totalAmount)}</Text>
                </View>
                <View style={styles.amountDivider} />
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>{isPrepaid ? '사용분' : '월별'}</Text>
                  <Text style={styles.amountValue}>{formatKrwFromRlusd(isPrepaid ? prepaidUsedAmount : escrow.monthlyAmount)}</Text>
                  <Text style={styles.amountUnit}>{formatRlusd(isPrepaid ? prepaidUsedAmount : escrow.monthlyAmount)}</Text>
                </View>
                <View style={styles.amountDivider} />
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>{isPrepaid ? '잔액' : '기간'}</Text>
                  <Text style={styles.amountValue}>{isPrepaid ? formatKrwFromRlusd(prepaidRemainingAmount) : escrow.months}</Text>
                  <Text style={styles.amountUnit}>{isPrepaid ? formatRlusd(prepaidRemainingAmount) : '개월'}</Text>
                </View>
              </View>

              {usageRange && (
                <View style={styles.usageRangeBox}>
                  <Text style={styles.usageRangeValue}>{usageRangeLabel} {usageRange}</Text>
                </View>
              )}

              {/* 진행률 */}
              <View style={styles.progressSection}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {progressText}
                </Text>
              </View>
            </View>
            {isPrepaid && escrow.status === 'cancelled' && (
              <View style={styles.refundSummaryCard}>
                <Text style={styles.refundSummaryTitle}>취소/환불 요약</Text>
                <View style={styles.refundSummaryRow}>
                  <View style={styles.refundSummaryItem}>
                    <Text style={styles.refundSummaryLabel}>사용분</Text>
                    <Text style={styles.refundSummaryValue}>사용 {formatKrwFromRlusd(releasedAmount)}</Text>
                    <Text style={styles.refundSummarySub}>{formatRlusd(releasedAmount)}</Text>
                  </View>
                  <View style={styles.refundSummaryItem}>
                    <Text style={styles.refundSummaryLabel}>환불분</Text>
                    <Text style={styles.refundSummaryValue}>환불 {formatKrwFromRlusd(refundedAmount)}</Text>
                    <Text style={styles.refundSummarySub}>{formatRlusd(refundedAmount)}</Text>
                  </View>
                </View>
                <Text style={styles.refundSummaryDesc}>환불 완료 {formatKrwFromRlusd(refundedAmount)}</Text>
              </View>
            )}
            {pendingChargeRequests.length > 0 && (
              <View style={styles.chargeRequestCard}>
                <Text style={styles.chargeRequestTitle}>승인 대기 차감 요청</Text>
                {pendingChargeRequests.map((request) => (
                  <View key={request.id} style={styles.chargeRequestItem}>
                    <Text style={styles.chargeRequestMenu}>
                      {request.menuName} {formatKrwFromRlusd(request.amount)}
                    </Text>
                    <Text style={styles.chargeRequestAmountSub}>{formatRlusd(request.amount)}</Text>
                    <Text style={styles.chargeRequestDesc}>
                      {escrow.business?.name ?? '사업자'}가 실제 이용 금액 차감을 요청했습니다. 승인하면 보호 금액권 잔액에서 차감됩니다.
                    </Text>
                    <View style={styles.chargeRequestActions}>
                      <TouchableOpacity
                        style={[styles.approveButton, approveChargeMutation.isPending && styles.buttonDisabled]}
                        onPress={() => setChargeRequestToAuthenticate(request)}
                        disabled={approveChargeMutation.isPending || rejectChargeMutation.isPending}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.approveButtonText}>승인하고 정산</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.rejectButton, rejectChargeMutation.isPending && styles.buttonDisabled]}
                        onPress={() => rejectChargeMutation.mutate(request.id)}
                        disabled={approveChargeMutation.isPending || rejectChargeMutation.isPending}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.rejectButtonText}>거절</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          </>
        }
        renderItem={({ item }: { item: EscrowEntry | ChargeRequest }) => {
          if (isChargeRequest(item)) {
            const requestStyle = STATUS_STYLE[item.status] ?? STATUS_STYLE.refunded;
            const approvedDate = isoToDate(item.approvedAt);
            const settledDate = isoToDate(item.settledAt);
            return (
              <View style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <View style={styles.entryMonthCircle}>
                    <Text style={styles.entryMonthText}>✓</Text>
                  </View>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryMonth}>{item.menuName} {formatKrwFromRlusd(item.amount)}</Text>
                    <Text style={styles.entryRlusd}>{formatRlusd(item.amount)}</Text>
                    <Text style={styles.entryDate}>
                      {approvedDate ? `승인: ${approvedDate}` : `요청: ${isoToDate(item.requestedAt) ?? '-'}`}
                      {settledDate ? ` · 정산: ${settledDate}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.entryBadge, { backgroundColor: requestStyle.bg }]}>
                    <Text style={[styles.entryBadgeText, { color: requestStyle.text }]}>
                      {STATUS_KO[item.status] ?? item.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.entryBottom}>
                  {item.txHash && (
                    <Text style={styles.txHash} numberOfLines={1}>
                      원장 증빙: {item.txHash}
                    </Text>
                  )}
                </View>
              </View>
            );
          }

          const entryStyle = STATUS_STYLE[item.status] ?? STATUS_STYLE.refunded;
          return (
            <View style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <View style={styles.entryMonthCircle}>
                  <Text style={styles.entryMonthText}>{item.month}</Text>
                </View>
                <View style={styles.entryInfo}>
                    <Text style={styles.entryMonth}>{item.month}월차</Text>
                  <Text style={styles.entryDate}>
                    정산 가능일: {rippleTimeToDate(item.finishAfter)}
                  </Text>
                </View>
                <View style={[styles.entryBadge, { backgroundColor: entryStyle.bg }]}>
                  <Text style={[styles.entryBadgeText, { color: entryStyle.text }]}>
                    {STATUS_KO[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <View style={styles.entryBottom}>
                <Text style={styles.entryAmount}>{formatKrwFromRlusd(item.amount)}</Text>
                <Text style={styles.entryRlusd}>{formatRlusd(item.amount)}</Text>
                {item.txHash && (
                  <Text style={styles.txHash} numberOfLines={1}>
                    원장 증빙: {item.txHash}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          isPrepaid ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>아직 차감 내역이 없습니다</Text>
              <Text style={styles.emptyDesc}>사업자가 실제 사용금액을 요청하면 여기에 표시됩니다</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          escrow.status === 'active' && pending > 0 ? (
            latestRefundReview ? (
              <View style={styles.refundReviewCard}>
                <Text style={styles.refundReviewTitle}>환불 검토 요청 접수됨</Text>
                <Text style={styles.refundReviewStatus}>{REFUND_REVIEW_STATUS_KO[latestRefundReview.status] ?? latestRefundReview.status}</Text>
                <Text style={styles.refundReviewDesc}>
                  환불 검토 금액 {formatKrwFromRlusd(latestRefundReview.refundableAmount)} · 사업자 응답 기한 {isoToDate(latestRefundReview.merchantRespondBy) ?? '-'}
                </Text>
                {!!latestRefundReview.investigationReason && (
                  <Text style={styles.refundReviewReason}>{latestRefundReview.investigationReason}</Text>
                )}
              </View>
            ) : (
              <View style={styles.refundReviewCard}>
                <Text style={styles.refundReviewDesc}>
                  실제 결제액, 보너스 혜택, 사용분 공제 후 환불 가능 금액을 산정합니다.
                </Text>
                <TouchableOpacity
                  style={[styles.refundReviewButton, refundReviewMutation.isPending && styles.buttonDisabled]}
                  onPress={handleRefundReviewRequest}
                  disabled={refundReviewMutation.isPending}
                  activeOpacity={0.8}
                >
                  <Text style={styles.refundReviewButtonText}>{refundReviewMutation.isPending ? '요청 접수 중...' : '환불 검토 요청'}</Text>
                </TouchableOpacity>
              </View>
            )
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
      <ApprovalAuthModal
        visible={!!chargeRequestToAuthenticate}
        title="결제 승인 인증"
        description="이용금액 차감을 승인하려면 본인 인증이 필요합니다."
        onCancel={() => setChargeRequestToAuthenticate(null)}
        onAuthenticated={() => {
          const request = chargeRequestToAuthenticate;
          if (!request) return;

          setChargeRequestToAuthenticate(null);
          approveChargeMutation.mutate(request.id);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  summaryCard: {
    backgroundColor: colors.white,
    padding: spacing.xl,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
    ...shadow.md,
  },
  ledgerLabel: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  businessName: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.gray900,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusText: { fontSize: font.size.sm, fontWeight: font.weight.semibold },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountItem: { flex: 1, alignItems: 'center' },
  amountLabel: { fontSize: font.size.xs, color: colors.gray400, marginBottom: 2 },
  amountValue: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: colors.gray900,
  },
  amountUnit: { fontSize: font.size.xs, color: colors.gray400, marginTop: 1 },
  usageRangeBox: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  usageRangeValue: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.gray800,
  },
  amountDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.gray200,
  },
  progressSection: { marginTop: spacing.xl },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.gray200,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: colors.success,
    borderRadius: 3,
  },
  progressText: {
    fontSize: font.size.sm,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  emptyContainer: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  emptyTitle: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.gray800 },
  emptyDesc: { fontSize: font.size.sm, color: colors.gray500, textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },
  chargeRequestCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  chargeRequestTitle: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.primaryDark,
    marginBottom: spacing.md,
  },
  chargeRequestItem: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  refundSummaryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadow.sm,
  },
  refundSummaryTitle: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  refundSummaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  refundSummaryItem: {
    flex: 1,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  refundSummaryLabel: {
    fontSize: font.size.xs,
    color: colors.gray400,
    marginBottom: spacing.xs,
  },
  refundSummaryValue: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.gray900,
  },
  refundSummarySub: {
    fontSize: font.size.xs,
    color: colors.gray400,
    marginTop: 2,
  },
  refundSummaryDesc: {
    fontSize: font.size.sm,
    color: colors.gray500,
    marginTop: spacing.md,
  },
  chargeRequestMenu: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.gray900,
  },
  chargeRequestAmountSub: {
    fontSize: font.size.xs,
    color: colors.gray400,
    marginTop: 2,
  },
  chargeRequestDesc: {
    fontSize: font.size.sm,
    color: colors.gray500,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  chargeRequestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  approveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  approveButtonText: { color: colors.white, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  rejectButton: {
    backgroundColor: colors.gray100,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  rejectButtonText: { color: colors.gray700, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  entryCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryMonthCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  entryMonthText: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.gray700,
  },
  entryInfo: { flex: 1 },
  entryMonth: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.gray800 },
  entryRlusd: { fontSize: font.size.xs, color: colors.gray400, marginTop: 1 },
  entryDate: { fontSize: font.size.xs, color: colors.gray400, marginTop: 1 },
  entryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  entryBadgeText: { fontSize: font.size.xs, fontWeight: font.weight.semibold },
  entryBottom: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    marginLeft: 48,
  },
  entryAmount: {
    fontSize: font.size.md,
    fontWeight: font.weight.medium,
    color: colors.gray700,
  },
  txHash: {
    fontSize: font.size.xs,
    color: colors.gray400,
    marginTop: spacing.xs,
    fontFamily: font.mono,
  },
  refundReviewCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.sm,
  },
  refundReviewDesc: {
    fontSize: font.size.sm,
    color: colors.gray600,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  refundReviewTitle: {
    fontSize: font.size.md,
    color: colors.gray900,
    fontWeight: font.weight.bold,
    marginBottom: spacing.xs,
  },
  refundReviewStatus: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warningLight,
    borderRadius: radius.full,
    color: colors.warning,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  refundReviewReason: {
    backgroundColor: colors.gray50,
    borderRadius: radius.sm,
    color: colors.gray600,
    fontSize: font.size.sm,
    lineHeight: 20,
    padding: spacing.md,
  },
  refundReviewButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  refundReviewButtonText: { color: colors.white, fontSize: font.size.md, fontWeight: font.weight.semibold },
});
