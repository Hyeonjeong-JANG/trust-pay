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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ApiError } from '../../api/client';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { useAuthStore } from '../../store/auth';
import { ErrorView } from '../../components/ErrorView';
import { BalanceCardSkeleton, BusinessSummaryRowSkeleton, EscrowCardSkeleton } from '../../components/Skeleton';
import { formatKrwFromRlusd, formatRlusd, krwToRlusd } from '../../utils/money';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { EscrowRecord, EscrowEntry, ProductMenuItem, PaymentRequest } from '@prepaid-shield/shared-types';

type StatusFilter = 'all' | 'active' | 'completed' | 'cancelled';
const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '진행중' },
  { key: 'completed', label: '완료' },
  { key: 'cancelled', label: '취소됨' },
];

type EscrowWithConsumer = EscrowRecord & { consumer?: { id: string; name: string } };
type ChargeRequestPayload = { menuItemId: string } | { menuName: string; amount: number };

export function BusinessDashboardScreen() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [manualChargeAmounts, setManualChargeAmounts] = useState<Record<string, string>>({});
  const [qrAmount, setQrAmount] = useState('');
  const [qrMonths, setQrMonths] = useState('6');
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const autoFinishedKeysRef = useRef<Set<string>>(new Set());

  const { data: dashboard, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['businessDashboard', userId],
    queryFn: () => api.getBusinessDashboard(userId!),
    enabled: !!userId,
    retry: 2,
  });

  const { data: balanceData, isLoading: balanceLoading, isError: balanceError, refetch: refetchBalance } = useQuery({
    queryKey: ['balance', userId],
    queryFn: () => api.getBalance(userId!, 'business'),
    enabled: !!userId,
    retry: 1,
  });

  const chargeRequestMutation = useMutation({
    mutationFn: ({ escrowId, payload }: { escrowId: string; payload: ChargeRequestPayload }) =>
      api.createChargeRequest(escrowId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessDashboard'] });
      showSuccessToast('이용분 승인 요청 전송', '소비자 승인 대기 상태로 등록되었습니다.');
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      showErrorToast('차감 요청 실패', apiErr.userMessage ?? err.message);
    },
  });

  const paymentRequestMutation = useMutation({
    mutationFn: () => api.createPaymentRequest({
      businessId: userId!,
      totalAmount: krwToRlusd(qrAmount),
      months: Number(qrMonths),
      escrowType: 'monthly',
    }),
    onSuccess: (request) => {
      setPaymentRequest(request);
      showSuccessToast('결제 QR 생성', '손님이 QR 코드를 스캔하면 계좌 승인 결제를 시작합니다.');
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      showErrorToast('QR 생성 실패', apiErr.userMessage ?? err.message);
    },
  });

  const onRefresh = useCallback(() => {
    refetch();
    refetchBalance();
  }, [refetch, refetchBalance]);

  const submitManualChargeRequest = useCallback((escrowId: string) => {
    const amount = krwToRlusd(manualChargeAmounts[escrowId] ?? '');
    if (amount <= 0) {
      showErrorToast('차감 요청 실패', '이용금액을 입력해주세요.');
      return;
    }
    chargeRequestMutation.mutate({
      escrowId,
      payload: { menuName: '직접 입력 이용금액', amount },
    });
  }, [chargeRequestMutation, manualChargeAmounts]);

  const submitPaymentRequest = useCallback(() => {
    if (krwToRlusd(qrAmount) <= 0 || Number(qrMonths) <= 0) {
      showErrorToast('QR 생성 실패', '결제 금액과 기간을 입력해주세요.');
      return;
    }
    paymentRequestMutation.mutate();
  }, [paymentRequestMutation, qrAmount, qrMonths]);

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

  const isFiltered = searchQuery.trim() !== '' || statusFilter !== 'all';

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

            <View style={styles.qrCard}>
              <View style={styles.qrHeader}>
                <View>
                  <Text style={styles.qrEyebrow}>사업자 결제 생성</Text>
                  <Text style={styles.qrTitle}>결제 QR 만들기</Text>
                </View>
                <Text style={styles.qrBadge}>QR</Text>
              </View>
              <Text style={styles.qrDesc}>
                사업자가 결제 내용을 먼저 만들고, 손님은 QR을 스캔해 계좌 승인만 합니다.
              </Text>
              <Text style={styles.manualChargeTitle}>이용금액 직접 입력</Text>
              <View style={styles.qrInputRow}>
                <TextInput
                  style={[styles.manualChargeInput, styles.qrAmountInput]}
                  placeholder="예: 810,000"
                  placeholderTextColor={colors.gray400}
                  keyboardType="number-pad"
                  value={qrAmount}
                  onChangeText={setQrAmount}
                />
                <TextInput
                  style={[styles.manualChargeInput, styles.qrMonthsInput]}
                  placeholder="예: 6"
                  placeholderTextColor={colors.gray400}
                  keyboardType="number-pad"
                  value={qrMonths}
                  onChangeText={setQrMonths}
                />
              </View>
              <TouchableOpacity
                style={[styles.manualChargeButton, paymentRequestMutation.isPending && styles.buttonDisabled]}
                onPress={submitPaymentRequest}
                disabled={paymentRequestMutation.isPending}
                activeOpacity={0.85}
              >
                <Text style={styles.manualChargeButtonText}>QR 결제 만들기</Text>
              </TouchableOpacity>
              {paymentRequest && (
                <View style={styles.generatedQrBox}>
                  <View style={styles.generatedQrGrid}>
                    {Array.from({ length: 16 }, (_, index) => (
                      <View key={index} style={index % 3 === 0 ? styles.generatedQrCellDark : styles.generatedQrCell} />
                    ))}
                  </View>
                  <View style={styles.generatedQrInfo}>
                    <Text style={styles.generatedQrLabel}>손님에게 보여줄 결제 코드</Text>
                    <Text style={styles.generatedQrCode}>{paymentRequest.code}</Text>
                  </View>
                </View>
              )}
            </View>

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
                ? '이미 보호 원장에 잠긴 이용권에서 이용분 차감 요청을 보냅니다. 소비자 승인 후 Token Escrow 단위로 정산됩니다'
                : 'EscrowFinish로 수령 가능한 월차만 정산됩니다'}
            </Text>
            <Text style={styles.sectionTitle}>
              {isFiltered
                ? `검색 결과 (${filteredEscrows.length}건)`
                : `에스크로 (${(dashboard?.escrows ?? []).length}건)`}
            </Text>
          </>
        }
        renderItem={({ item }: { item: EscrowWithConsumer }) => {
          const isPrepaid = item.escrowType === 'prepaid';
          const pendingEntries = item.entries?.filter((e: EscrowEntry) => e.status === 'pending') ?? [];
          const nextEntry = pendingEntries[0];
          const releasedCount = (item.entries?.length ?? 0) - pendingEntries.length;
          const totalEntries = item.entries?.length || item.months;
          const progressPct = totalEntries > 0 ? (releasedCount / totalEntries) * 100 : 0;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardAvatar}>
                  <Text style={styles.cardAvatarText}>
                    {(item.consumer?.name ?? '소')[0]}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{item.consumer?.name ?? '소비자'}</Text>
                  <Text style={styles.cardSub}>
                    {formatKrwFromRlusd(item.monthlyAmount)}/{isPrepaid ? '회' : '월'} · {pendingEntries.length}건 대기
                  </Text>
                  <Text style={styles.cardSubRlusd}>{formatRlusd(item.monthlyAmount)}</Text>
                </View>
                <View style={styles.cardAmountBlock}>
                  <Text style={styles.cardAmount}>{formatKrwFromRlusd(item.totalAmount)}</Text>
                  <Text style={styles.cardAmountSub}>{formatRlusd(item.totalAmount)}</Text>
                </View>
              </View>
              {/* 진행률 */}
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
              </View>
              {isPrepaid && (
                <View style={styles.manualChargeBox}>
                  <Text style={styles.manualChargeTitle}>이용금액 직접 입력</Text>
                  <Text style={styles.manualChargeDesc}>
                    실제 이용한 원화 금액을 입력하면 TrustPay가 RLUSD 보호 단위로 환산해 소비자 승인 요청을 보냅니다.
                  </Text>
                  <TextInput
                    style={styles.manualChargeInput}
                    placeholder="예: 67,500"
                    placeholderTextColor={colors.gray400}
                    keyboardType="number-pad"
                    value={manualChargeAmounts[item.id] ?? ''}
                    onChangeText={(value) => setManualChargeAmounts((current) => ({ ...current, [item.id]: value }))}
                  />
                  <TouchableOpacity
                    style={[styles.manualChargeButton, chargeRequestMutation.isPending && styles.buttonDisabled]}
                    onPress={() => submitManualChargeRequest(item.id)}
                    disabled={chargeRequestMutation.isPending}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.manualChargeButtonText}>입력 금액 승인 요청</Text>
                  </TouchableOpacity>
                </View>
              )}
              {isPrepaid && !!item.product?.menuItems?.length && (
                <View style={styles.menuRequestList}>
                  <Text style={styles.menuRequestTitle}>고객 이용분 승인 요청</Text>
                  {item.product.menuItems.map((menu: ProductMenuItem) => (
                    <TouchableOpacity
                      key={menu.id}
                      style={[styles.menuRequestButton, chargeRequestMutation.isPending && styles.buttonDisabled]}
                      onPress={() => chargeRequestMutation.mutate({ escrowId: item.id, payload: { menuItemId: menu.id } })}
                      disabled={chargeRequestMutation.isPending}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.menuRequestButtonText}>
                        {menu.name} 이용분 승인 요청 ({formatKrwFromRlusd(menu.amount)})
                      </Text>
                      <Text style={styles.menuRequestButtonSub}>{formatRlusd(menu.amount)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {!isPrepaid && nextEntry && (
                <Text style={styles.autoSettlementHint}>
                  조건 충족 월차는 사업자 조작 없이 자동 수령됩니다.
                </Text>
              )}
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
  qrCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  qrEyebrow: {
    fontSize: font.size.xs,
    color: colors.primary,
    fontWeight: font.weight.bold,
    marginBottom: 2,
  },
  qrTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: colors.gray900,
  },
  qrBadge: {
    backgroundColor: colors.primaryLight,
    color: colors.primary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  qrDesc: {
    fontSize: font.size.sm,
    color: colors.gray500,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  qrInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  qrAmountInput: { flex: 1 },
  qrMonthsInput: { width: 88 },
  generatedQrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.md,
  },
  generatedQrGrid: {
    width: 64,
    height: 64,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    padding: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  generatedQrCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.gray200,
  },
  generatedQrCellDark: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.gray900,
  },
  generatedQrInfo: { flex: 1 },
  generatedQrLabel: { fontSize: font.size.xs, color: colors.gray500, marginBottom: 2 },
  generatedQrCode: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.gray900,
    fontFamily: font.mono,
  },
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
  manualChargeBox: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
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
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  menuRequestTitle: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.gray700,
  },
  menuRequestButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  menuRequestButtonText: { color: colors.white, fontWeight: font.weight.semibold, fontSize: font.size.sm },
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
