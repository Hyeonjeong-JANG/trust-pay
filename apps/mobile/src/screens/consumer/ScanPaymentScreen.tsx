import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ApiError } from '../../api/client';
import { showErrorToast } from '../../utils/toast';
import { formatKrwWithRlusd } from '../../utils/money';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { ScreenProps } from '../../navigation/types';

export function ScanPaymentScreen({ navigation }: ScreenProps<'ScanPayment'>) {
  const [code, setCode] = useState('');

  const mutation = useMutation({
    mutationFn: (value: string) => api.getPaymentRequest(value),
    onSuccess: (request) => {
      navigation.navigate('Payment', {
        businessId: request.businessId,
        businessName: request.businessName,
        businessCategory: request.businessCategory ?? undefined,
        paymentRequest: request,
      });
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      showErrorToast('QR 조회 실패', apiErr.userMessage ?? err.message);
    },
  });

  const submit = useCallback(() => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      showErrorToast('QR 조회 실패', '결제 QR 코드를 입력해주세요.');
      return;
    }
    mutation.mutate(normalized);
  }, [code, mutation]);

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>TrustPay 현장 결제</Text>
        <Text style={styles.title}>QR 코드 입력</Text>
        <Text style={styles.desc}>
          사업자가 보여준 결제 QR의 코드를 입력한 뒤, 손님은 앱에서 계좌 승인만 합니다.
        </Text>
        <View style={styles.codeBadge}>
          <Text style={styles.codeBadgeText}>TP</Text>
        </View>
      </View>

      <View style={styles.inputCard}>
        <Text style={styles.label}>데모 QR 코드</Text>
        <Text style={styles.guideText}>사업자 화면에 표시된 TP-xxxxxx 코드를 입력하세요.</Text>
        <TextInput
          style={styles.input}
          placeholder="예: TP-123456"
          placeholderTextColor={colors.gray400}
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
        />
        <TouchableOpacity
          style={[styles.button, mutation.isPending && styles.buttonDisabled]}
          onPress={submit}
          disabled={mutation.isPending}
          activeOpacity={0.85}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>결제 QR 불러오기</Text>
          )}
        </TouchableOpacity>
        {mutation.data && (
          <Text style={styles.previewText}>
            {mutation.data.businessName} · {formatKrwWithRlusd(mutation.data.totalAmount)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  eyebrow: { fontSize: font.size.xs, color: colors.primary, fontWeight: font.weight.bold, marginBottom: spacing.xs },
  title: { fontSize: font.size.xxl, color: colors.gray900, fontWeight: font.weight.bold, marginBottom: spacing.sm },
  desc: { fontSize: font.size.sm, color: colors.gray500, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  codeBadge: {
    width: 160,
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.gray900,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  codeBadgeText: { color: colors.white, fontSize: 44, fontWeight: font.weight.bold, letterSpacing: -1 },
  inputCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, ...shadow.sm },
  label: { fontSize: font.size.sm, color: colors.gray700, fontWeight: font.weight.semibold, marginBottom: spacing.sm },
  guideText: { fontSize: font.size.xs, color: colors.gray500, lineHeight: 18, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.size.lg,
    color: colors.gray900,
    fontFamily: font.mono,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    minHeight: 52,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: colors.white, fontSize: font.size.md, fontWeight: font.weight.bold },
  previewText: { fontSize: font.size.sm, color: colors.gray500, marginTop: spacing.md, textAlign: 'center' },
});
