import React from 'react';
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
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { EscrowEntry } from '@prepaid-shield/shared-types';
import type { ScreenProps } from '../../navigation/types';
import type { EscrowRecord } from '@prepaid-shield/shared-types';
type EscrowWithRelations = EscrowRecord & { business?: { name: string }; consumer?: { name: string } };

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
  released: '릴리즈됨',
  refunded: '환불됨',
  active: '진행중',
  completed: '완료',
  cancelled: '취소됨',
};

function rippleTimeToDate(rippleTime: number): string {
  const RIPPLE_EPOCH = 946684800;
  return new Date((rippleTime + RIPPLE_EPOCH) * 1000).toLocaleDateString('ko-KR');
}

export function EscrowDetailScreen({ route }: ScreenProps<'EscrowDetail'>) {
  const { id } = route.params;
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['escrow', id],
    queryFn: () => api.getEscrow(id),
    retry: 2,
  });
  const escrow = data as EscrowWithRelations | undefined;

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelEscrow(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['escrow', id] });
      queryClient.invalidateQueries({ queryKey: ['consumerEscrows'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      Alert.alert('취소 완료', `${data.cancelled}건 환불됨`);
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      Alert.alert('취소 실패', apiErr.userMessage ?? err.message);
    },
  });

  const handleCancel = () => {
    Alert.alert(
      '에스크로 취소',
      '모든 대기 중인 항목이 환불됩니다. 계속하시겠습니까?',
      [
        { text: '아니오', style: 'cancel' },
        { text: '네, 취소합니다', style: 'destructive', onPress: () => cancelMutation.mutate() },
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
  const progressPct = escrow.months > 0 ? (released / escrow.months) * 100 : 0;
  const escrowStyle = STATUS_STYLE[escrow.status] ?? STATUS_STYLE.cancelled;

  return (
    <View style={styles.container}>
      <FlatList
        data={escrow.entries}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
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
                  <Text style={styles.amountValue}>{escrow.totalAmount.toLocaleString()}</Text>
                  <Text style={styles.amountUnit}>RLUSD</Text>
                </View>
                <View style={styles.amountDivider} />
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>월별</Text>
                  <Text style={styles.amountValue}>{escrow.monthlyAmount.toLocaleString()}</Text>
                  <Text style={styles.amountUnit}>RLUSD</Text>
                </View>
                <View style={styles.amountDivider} />
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>기간</Text>
                  <Text style={styles.amountValue}>{escrow.months}</Text>
                  <Text style={styles.amountUnit}>개월</Text>
                </View>
              </View>

              {/* 진행률 */}
              <View style={styles.progressSection}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {released}건 릴리즈 · {pending}건 대기
                </Text>
              </View>
            </View>
            <Text style={styles.sectionTitle}>월별 내역</Text>
          </>
        }
        renderItem={({ item }: { item: EscrowEntry }) => {
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
                    릴리즈: {rippleTimeToDate(item.finishAfter)}
                  </Text>
                </View>
                <View style={[styles.entryBadge, { backgroundColor: entryStyle.bg }]}>
                  <Text style={[styles.entryBadgeText, { color: entryStyle.text }]}>
                    {STATUS_KO[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <View style={styles.entryBottom}>
                <Text style={styles.entryAmount}>{Number(item.amount).toLocaleString()} RLUSD</Text>
                {item.txHash && (
                  <Text style={styles.txHash} numberOfLines={1}>
                    TX: {item.txHash}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          escrow.status === 'active' && pending > 0 ? (
            <TouchableOpacity
              style={[styles.cancelButton, cancelMutation.isPending && styles.buttonDisabled]}
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>
                {cancelMutation.isPending ? '취소 중...' : '에스크로 취소'}
              </Text>
            </TouchableOpacity>
          ) : null
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
  cancelButton: {
    backgroundColor: colors.danger,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.5 },
  cancelButtonText: { color: colors.white, fontSize: font.size.md, fontWeight: font.weight.semibold },
});
