import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
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

  const finishMutation = useMutation({
    mutationFn: ({ escrowId, month }: { escrowId: string; month: number }) =>
      api.finishEscrow(escrowId, month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessDashboard'] });
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
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Received</Text>
          <Text style={styles.summaryValue}>
            {dashboard?.totalReceived?.toLocaleString() ?? 0} RLUSD
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={styles.summaryValue}>
            {dashboard?.totalPending?.toLocaleString() ?? 0} RLUSD
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        Active Escrows ({dashboard?.activeEscrows ?? 0})
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
                <Text style={styles.cardTitle}>{item.consumer?.name ?? 'Consumer'}</Text>
                <Text style={styles.cardAmount}>{item.totalAmount} RLUSD</Text>
              </View>
              <Text style={styles.cardSub}>
                {item.monthlyAmount} RLUSD/month  ·  {pendingEntries.length} pending
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
                    Release Month {nextEntry.month} ({nextEntry.amount} RLUSD)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No active escrows</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
