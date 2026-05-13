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
import { formatKrwFromRlusd, formatRlusd, getWholeUnitCount, krwToRlusd } from '../../utils/money';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { EscrowRecord, EscrowEntry, ProductMenuItem } from '@prepaid-shield/shared-types';
import type { BusinessTabProps } from '../../navigation/types';

type StatusFilter = 'all' | 'active' | 'completed' | 'cancelled';
const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '진행중' },
  { key: 'completed', label: '완료' },
  { key: 'cancelled', label: '취소됨' },
];

type EscrowWithConsumer = EscrowRecord & { consumer?: { id: string; name: string } };
type ChargeRequestPayload = { menuItemId: string } | { menuName: string; amount: number };
type MenuDraft = { name: string; amount: string };
type ChargeMenuOption = {
  id: string;
  label: string;
  menuName: string;
  amount: number;
  menuItemId?: string;
};

const DIRECT_CHARGE_OPTION_ID = 'direct';

function getChargeUnitAmount(escrow: EscrowRecord): number {
  return Number(escrow.unitPrice ?? escrow.monthlyAmount);
}

function getChargeAmountError(escrow: EscrowRecord, amount: number): string | null {
  const unitAmount = getChargeUnitAmount(escrow);
  const unitCount = getWholeUnitCount(amount, unitAmount);
  if (unitCount === null) {
    return `이 이용권은 ${formatKrwFromRlusd(unitAmount)} 단위로 차감됩니다. 단위의 배수로 입력해주세요.`;
  }
  const availableCount = escrow.entries?.filter((entry) => entry.status === 'pending').length ?? 0;
  if (availableCount < unitCount) {
    return `차감 가능한 이용권이 ${availableCount}개 남았습니다. ${formatKrwFromRlusd(unitAmount)} 단위 ${availableCount}개 이하로 요청해주세요.`;
  }
  return null;
}

export function BusinessDashboardScreen({ navigation }: BusinessTabProps<'Dashboard'>) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [manualChargeAmounts, setManualChargeAmounts] = useState<Record<string, string>>({});
  const [manualChargeNames, setManualChargeNames] = useState<Record<string, string>>({});
  const [menuDrafts, setMenuDrafts] = useState<Record<string, MenuDraft>>({});
  const [customMenus, setCustomMenus] = useState<Record<string, ChargeMenuOption[]>>({});
  const [selectedChargeOptionIds, setSelectedChargeOptionIds] = useState<Record<string, string>>({});
  const [openChargeDropdowns, setOpenChargeDropdowns] = useState<Record<string, boolean>>({});
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

  const onRefresh = useCallback(() => {
    refetch();
    refetchBalance();
  }, [refetch, refetchBalance]);

  const updateMenuDraft = useCallback((escrowId: string, patch: Partial<MenuDraft>) => {
    setMenuDrafts((current) => {
      const currentDraft = current[escrowId] ?? { name: '', amount: '' };
      return { ...current, [escrowId]: { ...currentDraft, ...patch } };
    });
  }, []);

  const addCustomMenu = useCallback((escrow: EscrowWithConsumer) => {
    const draft = menuDrafts[escrow.id] ?? { name: '', amount: '' };
    const menuName = draft.name.trim();
    const amount = krwToRlusd(draft.amount);
    if (!menuName || amount <= 0) {
      showErrorToast('메뉴 추가 실패', '차감 항목명과 금액을 입력해주세요.');
      return;
    }
    const amountError = getChargeAmountError(escrow, amount);
    if (amountError) {
      showErrorToast('메뉴 추가 실패', amountError);
      return;
    }
    const menu: ChargeMenuOption = {
      id: `custom-${escrow.id}-${Date.now()}`,
      label: `${menuName} · ${formatKrwFromRlusd(amount)}`,
      menuName,
      amount,
    };
    setCustomMenus((current) => ({
      ...current,
      [escrow.id]: [...(current[escrow.id] ?? []), menu],
    }));
    setSelectedChargeOptionIds((current) => ({ ...current, [escrow.id]: menu.id }));
    setMenuDrafts((current) => ({ ...current, [escrow.id]: { name: '', amount: '' } }));
  }, [menuDrafts]);

  const submitChargeRequest = useCallback((escrow: EscrowWithConsumer, selectedOption?: ChargeMenuOption) => {
    if (selectedOption) {
      const amountError = getChargeAmountError(escrow, selectedOption.amount);
      if (amountError) {
        showErrorToast('차감 요청 실패', amountError);
        return;
      }
      chargeRequestMutation.mutate({
        escrowId: escrow.id,
        payload: selectedOption.menuItemId
          ? { menuItemId: selectedOption.menuItemId }
          : { menuName: selectedOption.menuName, amount: selectedOption.amount },
      });
      return;
    }

    const menuName = (manualChargeNames[escrow.id] ?? '').trim();
    const amount = krwToRlusd(manualChargeAmounts[escrow.id] ?? '');
    if (!menuName) {
      showErrorToast('차감 요청 실패', '차감 항목명을 입력해주세요.');
      return;
    }
    if (amount <= 0) {
      showErrorToast('차감 요청 실패', '이용금액을 입력해주세요.');
      return;
    }
    const amountError = getChargeAmountError(escrow, amount);
    if (amountError) {
      showErrorToast('차감 요청 실패', amountError);
      return;
    }
    chargeRequestMutation.mutate({
      escrowId: escrow.id,
      payload: { menuName, amount },
    });
  }, [chargeRequestMutation, manualChargeAmounts, manualChargeNames]);

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
                ? '이미 보호 원장에 잠긴 이용권에서 이용분 차감 요청을 보냅니다. 소비자 승인 후 Token Escrow 단위로 정산됩니다'
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
          const nextEntry = pendingEntries[0];
          const releasedCount = (item.entries?.length ?? 0) - pendingEntries.length;
          const totalEntries = item.entries?.length || item.months;
          const progressPct = totalEntries > 0 ? (releasedCount / totalEntries) * 100 : 0;
          const draft = menuDrafts[item.id] ?? { name: '', amount: '' };
          const menuOptions: ChargeMenuOption[] = [
            ...((item.product?.menuItems ?? []).map((menu: ProductMenuItem) => ({
              id: menu.id,
              label: `${menu.name} · ${formatKrwFromRlusd(menu.amount)}`,
              menuName: menu.name,
              amount: Number(menu.amount),
              menuItemId: menu.id,
            }))),
            ...(customMenus[item.id] ?? []),
          ];
          const selectedOptionId = selectedChargeOptionIds[item.id] ?? DIRECT_CHARGE_OPTION_ID;
          const selectedOption = menuOptions.find((option) => option.id === selectedOptionId);
          const isDirectSelected = selectedOptionId === DIRECT_CHARGE_OPTION_ID || !selectedOption;
          const isDropdownOpen = !!openChargeDropdowns[item.id];
          const unitAmount = getChargeUnitAmount(item);
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
                      {formatKrwFromRlusd(item.monthlyAmount)}/{isPrepaid ? '회' : '월'} · {pendingEntries.length}건 대기
                    </Text>
                    <Text style={styles.cardSubRlusd}>{formatRlusd(item.monthlyAmount)}</Text>
                  </View>
                  <View style={styles.cardAmountBlock}>
                    <Text style={styles.cardAmount}>{formatKrwFromRlusd(item.totalAmount)}</Text>
                    <Text style={styles.cardAmountSub}>{formatRlusd(item.totalAmount)}</Text>
                  </View>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                </View>
                {!isPrepaid && nextEntry && (
                  <Text style={styles.autoSettlementHint}>
                    조건 충족 월차는 사업자 조작 없이 자동 수령됩니다.
                  </Text>
                )}
              </TouchableOpacity>
              {isPrepaid && (
                <View style={styles.chargeRequestBox}>
                  <View style={styles.menuBuilderBox}>
                    <Text style={styles.manualChargeTitle}>차감 메뉴 등록</Text>
                    <Text style={styles.manualChargeDesc}>
                      자주 차감하는 항목을 여러 개 추가해두고 요청 시 드롭다운에서 선택합니다. 이 이용권은 {formatKrwFromRlusd(unitAmount)} 단위로 차감됩니다.
                    </Text>
                    <View style={styles.menuDraftRow}>
                      <TextInput
                        style={[styles.manualChargeInput, styles.menuNameInput]}
                        placeholder="예: PT 1회"
                        placeholderTextColor={colors.gray400}
                        value={draft.name}
                        onChangeText={(value) => updateMenuDraft(item.id, { name: value })}
                      />
                      <TextInput
                        style={[styles.manualChargeInput, styles.menuAmountInput]}
                        placeholder="예: 110,000"
                        placeholderTextColor={colors.gray400}
                        keyboardType="number-pad"
                        value={draft.amount}
                        onChangeText={(value) => updateMenuDraft(item.id, { amount: value })}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => addCustomMenu(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.secondaryButtonText}>메뉴 추가</Text>
                    </TouchableOpacity>
                    {!!customMenus[item.id]?.length && (
                      <View style={styles.addedMenuList}>
                        {customMenus[item.id].map((menu) => (
                          <Text key={menu.id} style={styles.addedMenuText}>{menu.label}</Text>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.menuRequestList}>
                    <Text style={styles.menuRequestTitle}>고객 이용분 승인 요청</Text>
                    <TouchableOpacity
                      style={styles.dropdownButton}
                      onPress={() => setOpenChargeDropdowns((current) => ({ ...current, [item.id]: !current[item.id] }))}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.dropdownLabel}>차감 항목 선택</Text>
                      <Text style={styles.dropdownValue}>{selectedOption?.label ?? '직접 입력'}</Text>
                    </TouchableOpacity>
                    {isDropdownOpen && (
                      <View style={styles.dropdownList}>
                        <TouchableOpacity
                          style={styles.dropdownOption}
                          onPress={() => {
                            setSelectedChargeOptionIds((current) => ({ ...current, [item.id]: DIRECT_CHARGE_OPTION_ID }));
                            setOpenChargeDropdowns((current) => ({ ...current, [item.id]: false }));
                          }}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.dropdownOptionText}>직접 입력</Text>
                        </TouchableOpacity>
                        {menuOptions.map((option) => (
                          <TouchableOpacity
                            key={option.id}
                            style={styles.dropdownOption}
                            onPress={() => {
                              setSelectedChargeOptionIds((current) => ({ ...current, [item.id]: option.id }));
                              setOpenChargeDropdowns((current) => ({ ...current, [item.id]: false }));
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
                        <Text style={styles.manualChargeDesc}>
                          어떤 이용분인지 항목명을 적고, 이용권 단위의 배수 금액으로 소비자 승인 요청을 보냅니다.
                        </Text>
                        <TextInput
                          style={styles.manualChargeInput}
                          placeholder="예: 수건 대여"
                          placeholderTextColor={colors.gray400}
                          value={manualChargeNames[item.id] ?? ''}
                          onChangeText={(value) => setManualChargeNames((current) => ({ ...current, [item.id]: value }))}
                        />
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
                          onPress={() => submitChargeRequest(item)}
                          disabled={chargeRequestMutation.isPending}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.manualChargeButtonText}>직접 입력 승인 요청</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.manualChargeButton, chargeRequestMutation.isPending && styles.buttonDisabled]}
                        onPress={() => submitChargeRequest(item, selectedOption)}
                        disabled={chargeRequestMutation.isPending}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.manualChargeButtonText}>선택 항목 승인 요청</Text>
                        {selectedOption && <Text style={styles.menuRequestButtonSub}>{formatRlusd(selectedOption.amount)}</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
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
