import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { colors, spacing, radius, font, shadow } from '../../theme';
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
      navigation.navigate('ConsumerTabs', { screen: 'Home' });
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.targetCard}>
          <View style={styles.targetAvatar}>
            <Text style={styles.targetAvatarText}>{businessName[0]}</Text>
          </View>
          <View>
            <Text style={styles.targetLabel}>대상 사업자</Text>
            <Text style={styles.targetName}>{businessName}</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>총 금액 (RLUSD)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="예: 600"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>기간 (개월)</Text>
            <TextInput
              style={styles.input}
              value={months}
              onChangeText={setMonths}
              keyboardType="numeric"
              placeholder="예: 6"
              placeholderTextColor={colors.gray400}
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>월별 릴리즈 금액</Text>
          <Text style={styles.infoValue}>{monthlyAmount} RLUSD</Text>
          <View style={styles.infoDivider} />
          <Text style={styles.infoDesc}>
            매월 {monthlyAmount} RLUSD가 Token Escrow(XLS-85)를 통해 {businessName}에게 릴리즈됩니다
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, (mutation.isPending || !amount || !months) && styles.buttonDisabled]}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending || !amount || !months}
          activeOpacity={0.8}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  targetAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  targetAvatarText: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.primary,
  },
  targetLabel: { fontSize: font.size.xs, color: colors.gray400 },
  targetName: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray900,
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  inputGroup: { marginBottom: spacing.lg },
  label: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    marginBottom: spacing.sm,
    color: colors.gray700,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: font.size.md,
    color: colors.gray800,
    backgroundColor: colors.gray50,
  },
  infoCard: {
    backgroundColor: colors.primaryLight,
    padding: spacing.xl,
    borderRadius: radius.md,
    marginBottom: spacing.xxl,
    alignItems: 'center',
  },
  infoLabel: { fontSize: font.size.sm, color: colors.primary },
  infoValue: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  infoDivider: {
    width: 40,
    height: 2,
    backgroundColor: colors.primary,
    opacity: 0.2,
    marginVertical: spacing.md,
    borderRadius: 1,
  },
  infoDesc: {
    fontSize: font.size.xs,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 16,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadow.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: font.size.md, fontWeight: font.weight.semibold },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
});
