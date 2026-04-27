import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { ErrorView } from '../../components/ErrorView';
import type { EscrowEntry } from '@prepaid-shield/shared-types';
import type { ScreenProps } from '../../navigation/types';

const STATUS_KO: Record<string, string> = {
  active: '진행중',
  completed: '완료',
  cancelled: '취소됨',
};

export function ConsumerDashboardScreen({ navigation }: ScreenProps<'ConsumerDashboard'>) {
  const userId = useAuthStore((s) => s.userId);

  const { data: escrows, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['consumerEscrows', userId],
    queryFn: () => api.getConsumerEscrows(userId!),
    enabled: !!userId,
    retry: 2,
  });

  const { data: balanceData } = useQuery({
    queryKey: ['balance', userId],
    queryFn: () => api.getBalance(userId!, 'consumer'),
    enabled: !!userId,
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
      {balanceData && (
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>RLUSD 잔액</Text>
          <Text style={styles.balanceValue}>
            {Number(balanceData.balance).toLocaleString()} RLUSD
          </Text>
          <Text style={styles.balanceAddr}>
            {balanceData.xrplAddress.slice(0, 8)}...{balanceData.xrplAddress.slice(-6)}
          </Text>
        </View>
      )}
      <Text style={styles.title}>내 선불 보호</Text>
      <FlatList
        data={escrows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const released = item.entries.filter((e: EscrowEntry) => e.status === 'released').length;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('EscrowDetail', { id: item.id })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.businessName}>{(item as any).business?.name ?? '사업자'}</Text>
                <View style={[styles.badge, item.status === 'active' ? styles.badgeActive : styles.badgeDone]}>
                  <Text style={styles.badgeText}>{STATUS_KO[item.status] ?? item.status}</Text>
                </View>
              </View>
              <Text style={styles.amount}>{item.totalAmount.toLocaleString()} RLUSD</Text>
              <Text style={styles.progress}>
                {released}/{item.months}개월 릴리즈됨
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>아직 에스크로가 없습니다. +를 눌러 시작하세요.</Text>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('BusinessSelect')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  businessName: { fontSize: 18, fontWeight: '600', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgeActive: { backgroundColor: '#E8F5E9' },
  badgeDone: { backgroundColor: '#F0F0F0' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#333' },
  amount: { fontSize: 16, color: '#333' },
  progress: { fontSize: 13, color: '#999', marginTop: 4 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
});
