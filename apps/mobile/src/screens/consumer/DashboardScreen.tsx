import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import type { EscrowRecord, EscrowEntry } from '@prepaid-shield/shared-types';

export function ConsumerDashboardScreen({ navigation }: any) {
  const userId = useAuthStore((s) => s.userId);

  const { data: escrows, isLoading } = useQuery({
    queryKey: ['consumerEscrows', userId],
    queryFn: () => api.getConsumerEscrows(userId!),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Prepaid Protections</Text>
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
                <Text style={styles.businessName}>{(item as any).business?.name ?? 'Business'}</Text>
                <View style={[styles.badge, item.status === 'active' ? styles.badgeActive : styles.badgeDone]}>
                  <Text style={styles.badgeText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.amount}>{item.totalAmount} RLUSD</Text>
              <Text style={styles.progress}>
                {released}/{item.months} months released
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No escrows yet. Tap + to get started.</Text>
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
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize', color: '#333' },
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
