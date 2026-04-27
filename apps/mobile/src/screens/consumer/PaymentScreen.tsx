import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import type { ScreenProps } from '../../navigation/types';

export function PaymentScreen({ route, navigation }: ScreenProps<'Payment'>) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const { businessId, businessName } = route.params;

  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState('6');

  const mutation = useMutation({
    mutationFn: () =>
      api.createEscrow({
        consumerId: userId!,
        businessId,
        totalAmount: Number(amount),
        months: Number(months),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumerEscrows'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      Alert.alert('성공', 'XRPL에 에스크로가 생성되었습니다!');
      navigation.navigate('ConsumerDashboard');
    },
    onError: (err: Error) => {
      const apiErr = err as import('../../api/client').ApiError;
      Alert.alert(
        '에스크로 생성 실패',
        apiErr.userMessage ?? err.message,
        apiErr.isRetryable ? [{ text: '확인' }, { text: '재시도', onPress: () => mutation.mutate() }] : undefined,
      );
    },
  });

  const monthlyAmount = amount && months ? (Number(amount) / Number(months)).toFixed(2) : '0';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>에스크로 생성</Text>
      <Text style={styles.businessLabel}>대상: {businessName}</Text>

      <Text style={styles.label}>총 금액 (RLUSD)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="예: 600"
      />

      <Text style={styles.label}>기간 (개월)</Text>
      <TextInput
        style={styles.input}
        value={months}
        onChangeText={setMonths}
        keyboardType="numeric"
        placeholder="예: 6"
      />

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>월별 릴리즈</Text>
        <Text style={styles.infoValue}>{monthlyAmount} RLUSD</Text>
        <Text style={styles.infoSub}>
          매월 {monthlyAmount} RLUSD가 Token Escrow(XLS-85)를 통해 {businessName}에게 릴리즈됩니다
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, (mutation.isPending || !amount || !months) && styles.buttonDisabled]}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending || !amount || !months}
      >
        {mutation.isPending ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.buttonText}> XRPL에 생성 중...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>에스크로 생성</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  businessLabel: { fontSize: 16, color: '#4A90D9', fontWeight: '500', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  infoTitle: { fontSize: 13, color: '#999' },
  infoValue: { fontSize: 24, fontWeight: 'bold', color: '#333', marginVertical: 4 },
  infoSub: { fontSize: 12, color: '#999', textAlign: 'center' },
  button: {
    backgroundColor: '#4A90D9',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
});
