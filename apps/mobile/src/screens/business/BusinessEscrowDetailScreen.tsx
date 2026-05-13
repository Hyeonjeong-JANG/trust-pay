import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { useBusinessMenuStore } from '../../store/businessMenus';
import { formatKrwFromRlusd, formatRlusd, krwToRlusd } from '../../utils/money';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { colors, font, radius, shadow, spacing } from '../../theme';
import type { ScreenProps } from '../../navigation/types';
import type { CreateChargeRequest, EscrowEntry, EscrowRecord, ProductMenuItem } from '@prepaid-shield/shared-types';

type EscrowWithRelations = EscrowRecord & {
  business?: { name: string };
  consumer?: { name: string };
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
  active: { bg: colors.escrow.activeBg, text: colors.escrow.active },
  completed: { bg: colors.escrow.completedBg, text: colors.escrow.completed },
  cancelled: { bg: colors.escrow.cancelledBg, text: colors.escrow.cancelled },
};

const STATUS_KO: Record<string, string> = {
  pending: '대기',
  released: '정산 완료',
  refunded: '환불됨',
  active: '진행중',
  completed: '완료',
  cancelled: '취소됨',
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

function getEntryTitle(isPrepaid: boolean, entry: EscrowEntry): string {
  if (isPrepaid) return `보호 원장 항목 ${entry.month}`;
  const suffix = entry.status === 'released' ? '정산 완료' : entry.status === 'refunded' ? '환불' : '정산 예정';
  return `${entry.month}월차 ${suffix}`;
}

export function BusinessEscrowDetailScreen({ route }: ScreenProps<'BusinessEscrowDetail'>) {
  const { id } = route.params;
  const queryClient = useQueryClient();
  const menusByBusinessId = useBusinessMenuStore((s) => s.menusByBusinessId);
  const [manualChargeName, setManualChargeName] = useState('');
  const [manualChargeAmount, setManualChargeAmount] = useState('');
  const [selectedChargeOptionId, setSelectedChargeOptionId] = useState(DIRECT_CHARGE_OPTION_ID);
  const [isChargeDropdownOpen, setIsChargeDropdownOpen] = useState(false);

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

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
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
                      <Text style={styles.chargeRequestButtonSub}>{formatRlusd(selectedChargeOption.amount)}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
            <Text style={styles.sectionTitle}>{isPrepaid ? '보호 원장 내역' : '월별 정산 내역'}</Text>
          </>
        }
        renderItem={({ item }) => {
          const entryStyle = STATUS_STYLE[item.status] ?? STATUS_STYLE.refunded;
          return (
            <View style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <View style={styles.entryMonthCircle}>
                  <Text style={styles.entryMonthText}>{item.month}</Text>
                </View>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryTitle}>{getEntryTitle(isPrepaid, item)}</Text>
                  <Text style={styles.entryDate}>
                    {isPrepaid ? '만료' : '정산 가능일'}: {rippleTimeToDate(isPrepaid ? item.cancelAfter : item.finishAfter)}
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
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>정산 단위가 없습니다</Text>
            <Text style={styles.emptyDesc}>손님 승인 후 정산 일정이 표시됩니다</Text>
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
