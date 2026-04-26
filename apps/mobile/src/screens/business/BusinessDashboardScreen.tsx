import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';

export function BusinessDashboardScreen() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['businessDashboard', userId],
    queryFn: () => api.getBusinessDashboard(userId!) as Promise<any>,
    enabled: !!userId,
  });

  const finishMutation = useMutation({
    mutationFn: ({ escrowId, month }: { escrowId: string; month: number }) =>
      api.finishEscrow(escrowId, month),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessDashboard'] });
      Alert.alert('Success', 'Payment released');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Business Dashboard</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Received</Text>
          <Text style={styles.summaryValue}>
            {dashboard?.totalReceived?.toLocaleString() ?? 0} XRP
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={styles.summaryValue}>
            {dashboard?.totalPending?.toLocaleString() ?? 0} XRP
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Active Escrows</Text>
      <FlatList
        data={dashboard?.escrows ?? []}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }: { item: any }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Customer: {item.consumer?.name}</Text>
            <Text>Monthly: {item.monthlyAmount} XRP</Text>
            {item.entries
              ?.filter((e: any) => e.status === 'pending')
              .slice(0, 1)
              .map((entry: any) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.releaseButton}
                  onPress={() =>
                    finishMutation.mutate({
                      escrowId: item.id,
                      month: entry.month,
                    })
                  }
                >
                  <Text style={styles.releaseButtonText}>
                    Release Month {entry.month}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No escrows</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  releaseButton: {
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  releaseButtonText: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
});
