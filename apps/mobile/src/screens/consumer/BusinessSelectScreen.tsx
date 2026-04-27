import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ErrorView } from '../../components/ErrorView';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { Business } from '@prepaid-shield/shared-types';
import type { ScreenProps } from '../../navigation/types';

export function BusinessSelectScreen({ navigation }: ScreenProps<'BusinessSelect'>) {
  const { data: businesses, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['businesses'],
    queryFn: () => api.getBusinesses(),
    retry: 2,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return <ErrorView error={error} onRetry={() => refetch()} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={businesses}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>사업자 선택</Text>
            <Text style={styles.subtitle}>선불 보호를 설정할 사업자를 선택하세요</Text>
          </View>
        }
        renderItem={({ item }: { item: Business }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate('Payment', {
                businessId: item.id,
                businessName: item.name,
              })
            }
            activeOpacity={0.7}
          >
            <View style={styles.cardLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name[0]}</Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={styles.businessName}>{item.name}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{item.category}</Text>
                </View>
              </View>
              <Text style={styles.address}>{item.address}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏪</Text>
            <Text style={styles.emptyText}>등록된 사업자가 없습니다</Text>
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
  listContent: { padding: spacing.lg },
  header: { marginBottom: spacing.xl },
  title: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  subtitle: { fontSize: font.size.sm, color: colors.gray500 },
  card: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.sm,
  },
  cardLeft: { marginRight: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: colors.primary,
  },
  cardContent: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  businessName: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.gray900,
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  categoryText: { fontSize: font.size.xs, color: colors.primary, fontWeight: font.weight.medium },
  address: { fontSize: font.size.sm, color: colors.gray500 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { fontSize: font.size.md, color: colors.gray400 },
});
