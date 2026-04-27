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

export function PaymentScreen({ route, navigation }: any) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const { businessId, businessName } = route.params ?? {};

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
      Alert.alert('Success', 'Escrow created on XRPL!');
      navigation.navigate('ConsumerDashboard');
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  const monthlyAmount = amount && months ? (Number(amount) / Number(months)).toFixed(2) : '0';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Escrow</Text>
      <Text style={styles.businessLabel}>To: {businessName}</Text>

      <Text style={styles.label}>Total Amount (RLUSD)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="e.g. 600"
      />

      <Text style={styles.label}>Duration (months)</Text>
      <TextInput
        style={styles.input}
        value={months}
        onChangeText={setMonths}
        keyboardType="numeric"
        placeholder="e.g. 6"
      />

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Monthly Release</Text>
        <Text style={styles.infoValue}>{monthlyAmount} RLUSD</Text>
        <Text style={styles.infoSub}>
          Each month, {monthlyAmount} RLUSD is released to {businessName} via Token Escrow (XLS-85)
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
            <Text style={styles.buttonText}> Creating on XRPL...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>Create Escrow</Text>
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
