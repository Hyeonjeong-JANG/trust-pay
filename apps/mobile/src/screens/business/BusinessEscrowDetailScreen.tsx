import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ApiError } from '../../api/client';
import { ErrorView } from '../../components/ErrorView';
import { XrplTransactionProof } from '../../components/XrplTransactionProof';
import { useBusinessMenuStore } from '../../store/businessMenus';
import { formatKrwFromRlusd, formatKrwWithRlusd, formatRlusd, krwToRlusd } from '../../utils/money';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { colors, font, radius, shadow, spacing } from '../../theme';
import type { ScreenProps } from '../../navigation/types';
import type { ChargeRequest, CreateChargeRequest, EscrowEntry, EscrowRecord, ProductMenuItem, RefundReviewRequest } from '@prepaid-shield/shared-types';

type EscrowWithRelations = EscrowRecord & {
  business?: { name: string };
  consumer?: { name: string };
  refundReviewRequests?: RefundReviewRequest[];
};

type ChargeMenuOption = {
  id: string;
  label: string;
  menuName: string;
  amount: number;
  menuItemId?: string;
};

const DIRECT_CHARGE_OPTION_ID = 'direct';

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
  cancel_failed: { bg: colors.escrow.cancelledBg, text: colors.escrow.cancelled },
};

const STATUS_KO: Record<string, string> = {
  pending: '대기',
  released: '정산 완료',
  refunded: '환불됨',
  pending_approval: '승인 대기',
  settled: '정산 완료',
  rejected: '거절됨',
  expired: '만료됨',
  active: '진행중',
  completed: '완료',
  cancelled: '취소됨',
  cancel_failed: '취소 재시도 필요',
};

const REFUND_REVIEW_STATUS_KO: Record<string, string> = {
  platform_review: 'TrustPay 확인 중',
  merchant_response_requested: '사업자 답변 대기',
  merchant_responded: '사업자 답변 완료',
  merchant_review: '사업자 답변 대기',
  merchant_disputed: '사업자 이의제기',
  platform_investigation: 'TrustPay 추가 확인 중',
  closure_suspected: '영업중단 의심 · TrustPay 추가 확인',
  closure_confirmed: '폐업 확인 · TrustPay 확인',
  auto_approved: '무응답 자동 승인',
  platform_approved: 'TrustPay 환불 승인',
  refunded: '환불 완료',
  rejected: '환불 검토 거절',
};

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

function getEntryTitle(entry: EscrowEntry): string {
  const suffix = entry.status === 'released' ? '정산 완료' : entry.status === 'refunded' ? '환불' : '정산 예정';
  return `${entry.month}월차 ${suffix}`;
}

function isChargeRequest(item: EscrowEntry | ChargeRequest): item is ChargeRequest {
  return 'menuName' in item;
}

function getLatestRefundReview(requests?: RefundReviewRequest[]): RefundReviewRequest | null {
  if (!requests?.length) return null;
  return requests
    .filter((request) => MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES.has(request.status))
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0] ?? null;
}

function sumEntries(entries: EscrowEntry[], status: string): number {
  return entries
    .filter((entry) => entry.status === status)
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
}

export function BusinessEscrowDetailScreen({ route }: ScreenProps<'BusinessEscrowDetail'>) {
  const { id } = route.params;
  const queryClient = useQueryClient();
  const menusByBusinessId = useBusinessMenuStore((s) => s.menusByBusinessId);
  const [manualChargeName, setManualChargeName] = useState('');
  const [manualChargeAmount, setManualChargeAmount] = useState('');
  const [selectedChargeOptionId, setSelectedChargeOptionId] = useState(DIRECT_CHARGE_OPTION_ID);
  const [isChargeDropdownOpen, setIsChargeDropdownOpen] = useState(false);
  const [merchantResponse, setMerchantResponse] = useState('');

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['escrow', id],
    queryFn: () => api.getEscrow(id),
    retry: 2,
  });
  const escrow = data as EscrowWithRelations | undefined;

  const chargeRequestMutation = useMutation({
    mutationFn: (payload: CreateChargeRequest) => api.createChargeRequest(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escrow', id] });
      queryClient.invalidateQueries({ queryKey: ['businessDashboard'] });
      setManualChargeName('');
      setManualChargeAmount('');
      showSuccessToast('이용분 승인 요청 전송', '소비자 승인 대기 상태로 등록되었습니다.');
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      showErrorToast('차감 요청 실패', apiErr.userMessage ?? err.message);
    },
  });

  const refundReviewResponseMutation = useMutation({
    mutationFn: ({ requestId, response, review }: { requestId: string; response: string; review: RefundReviewRequest }) =>
      api.respondToRefundReviewRequest(requestId, {
        response,
        escrowId: escrow?.id,
        consumerId: escrow?.consumerId,
        businessId: escrow?.businessId,
        refundableAmount: review.refundableAmount,
        merchantNotice: review.merchantNotice,
        merchantRespondBy: review.merchantRespondBy ? String(review.merchantRespondBy) : null,
        requestedAt: String(review.requestedAt),
      }),
    onSuccess: () => {
      setMerchantResponse('');
      queryClient.invalidateQueries({ queryKey: ['escrow', id] });
      queryClient.invalidateQueries({ queryKey: ['businessDashboard'] });
      showSuccessToast('답변 제출 완료', 'TrustPay 운영 확인 절차에 사업자 답변을 전달했습니다.');
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      showErrorToast('답변 제출 실패', apiErr.userMessage ?? err.message);
    },
  });

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

  const entries = escrow.entries ?? [];
  const released = entries.filter((entry) => entry.status === 'released').length;
  const pending = entries.filter((entry) => entry.status === 'pending').length;
  const refunded = entries.filter((entry) => entry.status === 'refunded').length;
  const totalEntries = entries.length || escrow.months;
  const isPrepaid = escrow.escrowType === 'prepaid';
  const escrowStyle = STATUS_STYLE[escrow.status] ?? STATUS_STYLE.cancelled;
  const usageRange = isPrepaid ? getPrepaidUsageRange(escrow) : getEntryUsageRange(entries);
  const usageRangeLabel = isPrepaid ? '사용기한' : '이용기간';
  const settledChargeAmount = (escrow.chargeRequests ?? [])
    .filter((request) => request.status === 'settled')
    .reduce((sum, request) => sum + Number(request.amount), 0);
  const releasedAmount = entries
    .filter((entry) => entry.status === 'released')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const prepaidUsedAmount = isPrepaid && settledChargeAmount > 0 ? settledChargeAmount : releasedAmount;
  const prepaidRemainingAmount = Math.max(Number(escrow.totalAmount) - prepaidUsedAmount, 0);
  const progressPct = isPrepaid
    ? Number(escrow.totalAmount) > 0 ? (prepaidUsedAmount / Number(escrow.totalAmount)) * 100 : 0
    : totalEntries > 0 ? (released / totalEntries) * 100 : 0;
  const progressText = isPrepaid
    ? `사용 ${formatKrwFromRlusd(prepaidUsedAmount)} · 잔액 ${formatKrwFromRlusd(prepaidRemainingAmount)}${refunded > 0 ? ` · 환불 ${refunded}건` : ''}`
    : `${released}개월 정산 완료 · ${pending}개월 예정${refunded > 0 ? ` · ${refunded}개월 환불` : ''}`;
  const localMenus = escrow.businessId ? menusByBusinessId[escrow.businessId] ?? [] : [];
  const chargeHistory = escrow.chargeRequests ?? [];
  const latestRefundReview = getLatestRefundReview(escrow.refundReviewRequests);
  const refundedAmount = sumEntries(entries, 'refunded');
  const refundCompleted = latestRefundReview?.status === 'refunded' || (escrow.status === 'cancelled' && refundedAmount > 0);
  const refundCompletedAmount = refundedAmount > 0 ? refundedAmount : Number(latestRefundReview?.refundableAmount || 0);
  const refundProofTxHash = entries.find((entry) => entry.status === 'refunded' && entry.txHash)?.txHash;
  const refundCompletedDesc = `소비자에게 미사용분 환불 완료 ${formatKrwFromRlusd(refundCompletedAmount)}`;
  const listData: Array<EscrowEntry | ChargeRequest> = isPrepaid ? chargeHistory : entries;
  const chargeMenuOptions: ChargeMenuOption[] = [
    ...((escrow.product?.menuItems ?? []).map((menu: ProductMenuItem) => ({
      id: menu.id,
      label: `${menu.name} · ${formatKrwFromRlusd(menu.amount)}`,
      menuName: menu.name,
      amount: Number(menu.amount),
      menuItemId: menu.id,
    }))),
    ...localMenus.map((menu) => ({
      id: menu.id,
      label: `${menu.name} · ${formatKrwFromRlusd(menu.amount)}`,
      menuName: menu.name,
      amount: menu.amount,
    })),
  ];
  const selectedChargeOption = chargeMenuOptions.find((option) => option.id === selectedChargeOptionId);
  const isDirectSelected = selectedChargeOptionId === DIRECT_CHARGE_OPTION_ID || !selectedChargeOption;

  const submitSelectedChargeRequest = () => {
    if (!selectedChargeOption) return;
    chargeRequestMutation.mutate(
      selectedChargeOption.menuItemId
        ? { menuItemId: selectedChargeOption.menuItemId }
        : { menuName: selectedChargeOption.menuName, amount: selectedChargeOption.amount },
    );
  };

  const submitManualChargeRequest = () => {
    const menuName = manualChargeName.trim();
    const amount = krwToRlusd(manualChargeAmount);
    if (!menuName) {
      showErrorToast('차감 요청 실패', '차감 항목명을 입력해주세요.');
      return;
    }
    if (amount <= 0) {
      showErrorToast('차감 요청 실패', '이용금액을 입력해주세요.');
      return;
    }
    chargeRequestMutation.mutate({ menuName, amount });
  };

  const submitMerchantResponse = () => {
    if (!latestRefundReview) return;
    const response = merchantResponse.trim();
    if (response.length < 10) {
      showErrorToast('답변 제출 실패', '답변 내용을 10자 이상 입력해주세요.');
      return;
    }
    refundReviewResponseMutation.mutate({ requestId: latestRefundReview.id, response, review: latestRefundReview });
  };

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
              <Text style={styles.ledgerLabel}>사업자 결제 상세</Text>
              <View style={styles.summaryTop}>
                <View style={styles.customerBlock}>
                  <Text style={styles.customerName}>고객 {escrow.consumer?.name ?? '소비자'}</Text>
                  <Text style={styles.businessName}>{escrow.business?.name ?? '사업자'} 정산 원장</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: escrowStyle.bg }]}> 
                  <Text style={[styles.statusText, { color: escrowStyle.text }]}> 
                    {STATUS_KO[escrow.status] ?? escrow.status}
                  </Text>
                </View>
              </View>

              <View style={styles.amountRow}>
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>총 결제 보호액</Text>
                  <Text style={styles.amountValue}>{formatKrwFromRlusd(escrow.totalAmount)}</Text>
                  <Text style={styles.amountUnit}>{formatRlusd(escrow.totalAmount)}</Text>
                </View>
                <View style={styles.amountDivider} />
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>{isPrepaid ? '잔액' : '월별 정산'}</Text>
                  <Text style={styles.amountValue}>{formatKrwFromRlusd(isPrepaid ? prepaidRemainingAmount : escrow.monthlyAmount)}</Text>
                  <Text style={styles.amountUnit}>{formatRlusd(isPrepaid ? prepaidRemainingAmount : escrow.monthlyAmount)}</Text>
                </View>
              </View>

              {usageRange && (
                <View style={styles.usageRangeBox}>
                  <Text style={styles.usageRangeValue}>{usageRangeLabel} {usageRange}</Text>
                </View>
              )}

              <View style={styles.progressSection}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                </View>
                <Text style={styles.progressText}>{progressText}</Text>
              </View>
            </View>
            {refundCompleted ? (
              <View style={styles.refundReviewCard}>
                <View style={styles.refundReviewHeader}>
                  <Text style={styles.refundReviewTitle}>환불 처리 완료</Text>
                  <Text style={styles.refundReviewStatus}>환불 완료</Text>
                </View>
                <Text style={styles.refundReviewDesc}>{refundCompletedDesc}</Text>
                {latestRefundReview?.resolvedAt && (
                  <Text style={styles.refundReviewDesc}>처리일 {isoToDate(latestRefundReview.resolvedAt) ?? '-'}</Text>
                )}
                {!!latestRefundReview?.adminResolutionReason && (
                  <View style={styles.refundReviewReasonBox}>
                    <Text style={styles.refundReviewReasonLabel}>TrustPay 처리 메모</Text>
                    <Text style={styles.refundReviewReason}>{latestRefundReview.adminResolutionReason}</Text>
                  </View>
                )}
                {refundProofTxHash && (
                  <XrplTransactionProof txHash={refundProofTxHash} label="환불 처리 증빙" />
                )}
              </View>
            ) : latestRefundReview && (
              <View style={styles.refundReviewCard}>
                <View style={styles.refundReviewHeader}>
                  <Text style={styles.refundReviewTitle}>환불 검토 요청 접수됨</Text>
                  <Text style={styles.refundReviewStatus}>{REFUND_REVIEW_STATUS_KO[latestRefundReview.status] ?? latestRefundReview.status}</Text>
                </View>
                <Text style={styles.refundReviewDesc}>
                  환불 검토 금액 {formatKrwFromRlusd(latestRefundReview.refundableAmount)} · 사업자 답변 기한 {isoToDate(latestRefundReview.merchantRespondBy) ?? '-'}
                </Text>
                {!!latestRefundReview.merchantNotice && (
                  <View style={styles.refundReviewReasonBox}>
                    <Text style={styles.refundReviewReasonLabel}>TrustPay 답변 요청</Text>
                    <Text style={styles.refundReviewReason}>{latestRefundReview.merchantNotice}</Text>
                  </View>
                )}
                {latestRefundReview.status === 'merchant_response_requested' && (
                  <View style={styles.refundReviewResponseBox}>
                    <TextInput
                      style={styles.refundReviewResponseInput}
                      placeholder="TrustPay에 전달할 답변 내용을 입력해주세요"
                      placeholderTextColor={colors.gray400}
                      value={merchantResponse}
                      onChangeText={setMerchantResponse}
                      multiline
                      textAlignVertical="top"
                      maxLength={1000}
                    />
                    <TouchableOpacity
                      style={[styles.refundReviewResponseButton, refundReviewResponseMutation.isPending && styles.buttonDisabled]}
                      onPress={submitMerchantResponse}
                      disabled={refundReviewResponseMutation.isPending}
                      activeOpacity={0.84}
                    >
                      <Text style={styles.refundReviewResponseButtonText}>{refundReviewResponseMutation.isPending ? '제출 중...' : '답변 제출'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
            {isPrepaid && (
              <View style={styles.chargeRequestCard}>
                <Text style={styles.chargeRequestTitle}>고객 이용분 승인 요청</Text>
                <Text style={styles.chargeRequestDesc}>
                  등록 메뉴를 선택하거나 실제 이용 항목과 금액을 직접 입력해 손님 승인 요청을 보냅니다.
                </Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setIsChargeDropdownOpen((current) => !current)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dropdownLabel}>차감 항목 선택</Text>
                  <Text style={styles.dropdownValue}>{selectedChargeOption?.label ?? '직접 입력'}</Text>
                </TouchableOpacity>
                {isChargeDropdownOpen && (
                  <View style={styles.dropdownList}>
                    <TouchableOpacity
                      style={styles.dropdownOption}
                      onPress={() => {
                        setSelectedChargeOptionId(DIRECT_CHARGE_OPTION_ID);
                        setIsChargeDropdownOpen(false);
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.dropdownOptionText}>직접 입력</Text>
                    </TouchableOpacity>
                    {chargeMenuOptions.map((option) => (
                      <TouchableOpacity
                        key={option.id}
                        style={styles.dropdownOption}
                        onPress={() => {
                          setSelectedChargeOptionId(option.id);
                          setIsChargeDropdownOpen(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.dropdownOptionText}>{option.label}</Text>
                        <Text style={styles.dropdownOptionSub}>{formatRlusd(option.amount)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {isDirectSelected ? (
                  <View style={styles.manualChargeBox}>
                    <Text style={styles.manualChargeTitle}>이용금액 직접 입력</Text>
                    <TextInput
                      style={styles.manualChargeInput}
                      placeholder="예: 수건 대여"
                      placeholderTextColor={colors.gray400}
                      value={manualChargeName}
                      onChangeText={setManualChargeName}
                    />
                    <TextInput
                      style={styles.manualChargeInput}
                      placeholder="예: 67,500"
                      placeholderTextColor={colors.gray400}
                      keyboardType="number-pad"
                      value={manualChargeAmount}
                      onChangeText={setManualChargeAmount}
                    />
                    <TouchableOpacity
                      style={[styles.chargeRequestButton, chargeRequestMutation.isPending && styles.buttonDisabled]}
                      onPress={submitManualChargeRequest}
                      disabled={chargeRequestMutation.isPending}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.chargeRequestButtonText}>직접 입력 승인 요청</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.chargeRequestButton, chargeRequestMutation.isPending && styles.buttonDisabled]}
                    onPress={submitSelectedChargeRequest}
                    disabled={chargeRequestMutation.isPending}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.chargeRequestButtonText}>선택 항목 승인 요청</Text>
                    {selectedChargeOption && (
                      <Text style={styles.chargeRequestButtonSub}>{formatKrwWithRlusd(selectedChargeOption.amount)}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
            <Text style={styles.sectionTitle}>{isPrepaid ? '차감 내역' : '월별 정산 내역'}</Text>
          </>
        }
        renderItem={({ item }) => {
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
                    <Text style={styles.entryTitle}>{item.menuName} {formatKrwFromRlusd(item.amount)}</Text>
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
                  <Text style={styles.entryAmount}>{formatKrwFromRlusd(item.amount)}</Text>
                  <Text style={styles.entryRlusd}>{formatRlusd(item.amount)}</Text>
                  {item.txHash && (
                    <XrplTransactionProof txHash={item.txHash} label="차감 정산 증빙" />
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
                  <Text style={styles.entryTitle}>{getEntryTitle(item)}</Text>
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
                  <XrplTransactionProof txHash={item.txHash} />
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{isPrepaid ? '아직 차감 내역이 없습니다' : '정산 단위가 없습니다'}</Text>
            <Text style={styles.emptyDesc}>{isPrepaid ? '실제 사용금액 차감 요청을 보내면 여기에 표시됩니다' : '손님 승인 후 정산 일정이 표시됩니다'}</Text>
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
    gap: spacing.md,
  },
  customerBlock: { flex: 1 },
  customerName: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.gray900 },
  businessName: { fontSize: font.size.sm, color: colors.gray500, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  statusText: { fontSize: font.size.sm, fontWeight: font.weight.semibold },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  amountItem: { flex: 1, alignItems: 'center' },
  amountLabel: { fontSize: font.size.xs, color: colors.gray400, marginBottom: 2 },
  amountValue: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.gray900 },
  amountUnit: { fontSize: font.size.xs, color: colors.gray400, marginTop: 1 },
  amountDivider: { width: 1, height: 36, backgroundColor: colors.gray200 },
  usageRangeBox: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  usageRangeValue: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.gray800 },
  progressSection: { marginTop: spacing.xl },
  progressBarBg: { height: 6, backgroundColor: colors.gray200, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: colors.success, borderRadius: 3 },
  progressText: { fontSize: font.size.sm, color: colors.gray500, textAlign: 'center', marginTop: spacing.sm },
  refundReviewCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    ...shadow.sm,
  },
  refundReviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  refundReviewTitle: { color: colors.gray900, fontSize: font.size.md, fontWeight: font.weight.bold },
  refundReviewStatus: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.full,
    color: colors.warning,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  refundReviewDesc: { color: colors.gray700, fontSize: font.size.sm, lineHeight: 20 },
  refundReviewPolicy: {
    backgroundColor: colors.gray50,
    borderRadius: radius.sm,
    color: colors.gray600,
    fontSize: font.size.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  refundReviewReasonBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  refundReviewReasonLabel: {
    color: colors.primary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    marginBottom: spacing.xs,
  },
  refundReviewReason: { color: colors.gray700, fontSize: font.size.sm, lineHeight: 20 },
  refundReviewResponseBox: { gap: spacing.sm, marginTop: spacing.md },
  refundReviewResponseInput: {
    backgroundColor: colors.gray50,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.gray900,
    fontSize: font.size.md,
    minHeight: 96,
    padding: spacing.md,
  },
  refundReviewResponseButton: {
    alignItems: 'center',
    backgroundColor: colors.warning,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 44,
  },
  refundReviewResponseButtonText: { color: colors.white, fontSize: font.size.md, fontWeight: font.weight.bold },
  refundReviewPhotoBox: { marginTop: spacing.sm },
  refundReviewPhotoCount: {
    color: colors.gray600,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    marginBottom: spacing.xs,
  },
  refundReviewPhotoRow: { flexDirection: 'row', gap: spacing.xs },
  refundReviewPhotoThumb: {
    backgroundColor: colors.gray100,
    borderRadius: radius.sm,
    height: 48,
    width: 48,
  },
  chargeRequestCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    gap: spacing.sm,
    ...shadow.sm,
  },
  chargeRequestTitle: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.gray900 },
  chargeRequestDesc: { fontSize: font.size.sm, color: colors.gray500, lineHeight: 20 },
  dropdownButton: {
    backgroundColor: colors.gray50,
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
  manualChargeBox: { gap: spacing.sm },
  manualChargeTitle: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.gray800 },
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
  chargeRequestButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  chargeRequestButtonText: { color: colors.white, fontWeight: font.weight.semibold, fontSize: font.size.sm },
  chargeRequestButtonSub: { color: 'rgba(255,255,255,0.75)', fontSize: font.size.xs, marginTop: 2 },
  buttonDisabled: { opacity: 0.5 },
  sectionTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  entryCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center' },
  entryMonthCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  entryMonthText: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.gray700 },
  entryInfo: { flex: 1 },
  entryTitle: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.gray800 },
  entryDate: { fontSize: font.size.xs, color: colors.gray400, marginTop: 1 },
  entryBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full },
  entryBadgeText: { fontSize: font.size.xs, fontWeight: font.weight.semibold },
  entryBottom: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    marginLeft: 48,
  },
  entryAmount: { fontSize: font.size.md, fontWeight: font.weight.medium, color: colors.gray700 },
  entryRlusd: { fontSize: font.size.xs, color: colors.gray400, marginTop: 1 },
  txHash: { fontSize: font.size.xs, color: colors.gray400, marginTop: spacing.xs, fontFamily: font.mono },
  emptyContainer: { alignItems: 'center', paddingTop: 48 },
  emptyTitle: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.gray700, marginBottom: spacing.xs },
  emptyDesc: { fontSize: font.size.sm, color: colors.gray400, textAlign: 'center' },
});
