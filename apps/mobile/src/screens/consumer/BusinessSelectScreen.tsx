import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ErrorView } from '../../components/ErrorView';
import type { Business } from '@prepaid-shield/shared-types';
import type { ScreenProps } from '../../navigation/types';

export function BusinessSelectScreen({ navigation }: ScreenProps<'BusinessSelect'>) {
  const { data: businesses, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['businesses'],
    queryFn: () => api.getBusinesses(),
    retry: 2,
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
      <Text style={styles.title}>사업자 선택</Text>
      <Text style={styles.subtitle}>선불 보호를 설정할 사업자를 선택하세요</Text>
      <FlatList
        data={businesses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: Business }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate('Payment', {
                businessId: item.id,
                businessName: item.name,
              })
            }
          >
            <View style={styles.cardHeader}>
              <Text style={styles.businessName}>{item.name}</Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            </View>
            <Text style={styles.address}>{item.address}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>등록된 사업자가 없습니다</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
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
  categoryBadge: {
    backgroundColor: '#EBF3FB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: { fontSize: 12, color: '#4A90D9', fontWeight: '500' },
  address: { fontSize: 14, color: '#666' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
});
