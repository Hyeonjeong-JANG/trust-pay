import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';

export function ConsumerDashboardScreen({ navigation }: any) {
  const xrplAddress = useAuthStore((s) => s.xrplAddress);

  const { data: escrows, isLoading } = useQuery({
    queryKey: ['consumerEscrows', xrplAddress],
    queryFn: () => api.getConsumerEscrows(xrplAddress!),
    enabled: !!xrplAddress,
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
      <Text style={styles.title}>My Prepaid Protections</Text>
      <FlatList
        data={escrows as any[]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('EscrowDetail', { id: item.id })}
          >
            <Text style={styles.businessName}>{item.business?.name}</Text>
            <Text style={styles.amount}>
              {item.totalAmount.toLocaleString()} XRP
            </Text>
            <Text style={styles.status}>{item.status}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No escrows yet</Text>
        }
      />
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
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  businessName: { fontSize: 18, fontWeight: '600' },
  amount: { fontSize: 16, color: '#333', marginTop: 4 },
  status: { fontSize: 14, color: '#666', marginTop: 4, textTransform: 'capitalize' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
});
