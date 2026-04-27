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
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ApiError } from '../../api/client';
import { ErrorView } from '../../components/ErrorView';
import type { EscrowEntry } from '@prepaid-shield/shared-types';

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9500',
  released: '#34C759',
  refunded: '#8E8E93',
};

function rippleTimeToDate(rippleTime: number): string {
  const RIPPLE_EPOCH = 946684800;
  return new Date((rippleTime + RIPPLE_EPOCH) * 1000).toLocaleDateString();
}

export function EscrowDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const queryClient = useQueryClient();

  const { data: escrow, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['escrow', id],
    queryFn: () => api.getEscrow(id),
    retry: 2,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelEscrow(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['escrow', id] });
      queryClient.invalidateQueries({ queryKey: ['consumerEscrows'] });
      Alert.alert('Cancelled', `${data.cancelled} entries refunded`);
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      Alert.alert('취소 실패', apiErr.userMessage ?? err.message);
    },
  });

  const handleCancel = () => {
    Alert.alert(
      'Cancel Escrow',
      'This will refund all pending entries. Continue?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate() },
      ],
    );
  };

  if (isLoading || (!escrow && !isError)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  if (isError || !escrow) {
    return <ErrorView error={error ?? new Error('데이터를 불러올 수 없습니다.')} onRetry={() => refetch()} />;
  }

  const released = escrow.entries.filter((e: EscrowEntry) => e.status === 'released').length;
  const pending = escrow.entries.filter((e: EscrowEntry) => e.status === 'pending').length;

  return (
    <View style={styles.container}>
      {/* Summary card */}
      <View style={styles.summaryCard}>
        <Text style={styles.businessName}>{(escrow as any).business?.name ?? 'Business'}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{escrow.status}</Text>
        </View>
        <View style={styles.amountRow}>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Total</Text>
            <Text style={styles.amountValue}>{escrow.totalAmount} RLUSD</Text>
          </View>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Monthly</Text>
            <Text style={styles.amountValue}>{escrow.monthlyAmount} RLUSD</Text>
          </View>
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Duration</Text>
            <Text style={styles.amountValue}>{escrow.months} months</Text>
          </View>
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {released}/{escrow.months} released, {pending} pending
          </Text>
        </View>
      </View>

      {/* Entry list */}
      <Text style={styles.sectionTitle}>Monthly Entries</Text>
      <FlatList
        data={escrow.entries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: EscrowEntry }) => (
          <View style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryMonth}>Month {item.month}</Text>
              <View style={[styles.entryBadge, { backgroundColor: STATUS_COLORS[item.status] || '#ccc' }]}>
                <Text style={styles.entryBadgeText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.entryAmount}>{item.amount} RLUSD</Text>
            <Text style={styles.entryDate}>
              Releases after: {rippleTimeToDate(item.finishAfter)}
            </Text>
            {item.txHash && (
              <Text style={styles.txHash} numberOfLines={1}>
                TX: {item.txHash}
              </Text>
            )}
          </View>
        )}
      />

      {/* Cancel button */}
      {escrow.status === 'active' && pending > 0 && (
        <TouchableOpacity
          style={[styles.cancelButton, cancelMutation.isPending && styles.buttonDisabled]}
          onPress={handleCancel}
          disabled={cancelMutation.isPending}
        >
          <Text style={styles.cancelButtonText}>
            {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Escrow'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  businessName: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EBF3FB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: { fontSize: 13, color: '#4A90D9', fontWeight: '600', textTransform: 'capitalize' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between' },
  amountItem: { alignItems: 'center' },
  amountLabel: { fontSize: 12, color: '#999' },
  amountValue: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  progressRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  progressText: { fontSize: 13, color: '#666', textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  entryCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  entryMonth: { fontSize: 16, fontWeight: '600' },
  entryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  entryBadgeText: { fontSize: 12, color: '#fff', fontWeight: '600', textTransform: 'capitalize' },
  entryAmount: { fontSize: 14, color: '#333' },
  entryDate: { fontSize: 12, color: '#999', marginTop: 2 },
  txHash: { fontSize: 11, color: '#aaa', marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  cancelButton: {
    backgroundColor: '#FF3B30',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  buttonDisabled: { opacity: 0.5 },
  cancelButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
