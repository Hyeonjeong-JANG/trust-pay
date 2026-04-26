import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';

export function PaymentScreen({ route, navigation }: any) {
  const xrplAddress = useAuthStore((s) => s.xrplAddress);
  const queryClient = useQueryClient();
  const businessAddress = route?.params?.businessAddress || '';

  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState('6');

  const mutation = useMutation({
    mutationFn: () =>
      api.createEscrow({
        consumerAddress: xrplAddress!,
        businessAddress,
        totalAmount: Number(amount),
        months: Number(months),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumerEscrows'] });
      Alert.alert('Success', 'Escrow created successfully');
      navigation.goBack();
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Escrow Payment</Text>

      <Text style={styles.label}>Total Amount (XRP)</Text>
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

      <Text style={styles.info}>
        Monthly release: {amount && months ? (Number(amount) / Number(months)).toFixed(2) : '0'} XRP
      </Text>

      <TouchableOpacity
        style={[styles.button, mutation.isPending && styles.buttonDisabled]}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending || !amount || !months}
      >
        <Text style={styles.buttonText}>
          {mutation.isPending ? 'Creating...' : 'Create Escrow'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  info: { fontSize: 14, color: '#666', marginBottom: 24 },
  button: {
    backgroundColor: '#4A90D9',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
