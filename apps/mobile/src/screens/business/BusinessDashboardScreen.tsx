import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ApiError } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { ErrorView } from '../../components/ErrorView';

export function BusinessDashboardScreen() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['businessDashboard', userId],
    queryFn: () => api.getBusinessDashboard(userId!),
    enabled: !!userId,
    retry: 2,
  });

  const { data: balanceData, isLoading: balanceLoading, isError: balanceError } = useQuery({
    queryKey: ['balance', userId],
    queryFn: () => api.getBalance(userId!, 'business'),
    enabled: !!userId,
    retry: 1,
  });

  const finishMutation = useMutation({
    mutationFn: ({ escrowId, month }: { escrowId: string; month: number }) =>
      api.finishEscrow(escrowId, month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      Alert.alert('릴리즈 완료', '월 대금이 수령되었습니다.');
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      Alert.alert('릴리즈 실패', apiErr.userMessage ?? err.message);
    },
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  if (isError) {
    return <ErrorView error={error} onRetry={() => refetch()} />;
  }

  return (
    <View style={styles.container}>
      {balanceLoading ? (
        <View style={styles.balanceCard}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
        </View>
      ) : balanceError ? (
        <View style={[styles.balanceCard, { backgroundColor: '#8E8E93' }]}>
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

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>수령액</Text>
          <Text style={styles.summaryValue}>
            {dashboard?.totalReceived?.toLocaleString() ?? 0} RLUSD
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>대기액</Text>
          <Text style={styles.summaryValue}>
            {dashboard?.totalPending?.toLocaleString() ?? 0} RLUSD
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        활성 에스크로 ({dashboard?.activeEscrows ?? 0})
      </Text>
      <FlatList
        data={dashboard?.escrows ?? []}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }: { item: any }) => {
          const pendingEntries = item.entries?.filter((e: any) => e.status === 'pending') ?? [];
          const nextEntry = pendingEntries[0];
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.consumer?.name ?? '소비자'}</Text>
                <Text style={styles.cardAmount}>{item.totalAmount.toLocaleString()} RLUSD</Text>
              </View>
              <Text style={styles.cardSub}>
                {item.monthlyAmount.toLocaleString()} RLUSD/월  ·  {pendingEntries.length}건 대기
              </Text>
              {nextEntry && (
                <TouchableOpacity
                  style={[styles.releaseButton, finishMutation.isPending && styles.buttonDisabled]}
                  onPress={() =>
                    finishMutation.mutate({
                      escrowId: item.id,
                      month: nextEntry.month,
                    })
                  }
                  disabled={finishMutation.isPending}
                >
                  <Text style={styles.releaseButtonText}>
                    {nextEntry.month}월차 릴리즈 ({Number(nextEntry.amount).toLocaleString()} RLUSD)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>활성 에스크로가 없습니다</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  balanceCard: {
    backgroundColor: '#4A90D9',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  balanceValue: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginVertical: 4 },
  balanceAddr: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardAmount: { fontSize: 14, color: '#4A90D9', fontWeight: '600' },
  cardSub: { fontSize: 13, color: '#999', marginTop: 4, marginBottom: 8 },
  releaseButton: {
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  releaseButtonText: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
});
