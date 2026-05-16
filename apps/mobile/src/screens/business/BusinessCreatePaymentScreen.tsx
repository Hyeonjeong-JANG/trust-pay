import React, { useCallback, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ApiError } from '../../api/client';
import { PaymentRequestQrCode } from '../../components/PaymentRequestQrCode';
import { useAuthStore } from '../../store/auth';
import { formatKrwFromRlusd, formatRlusd, krwToRlusd, roundRlusd } from '../../utils/money';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { colors, font, radius, shadow, spacing } from '../../theme';
import type { PaymentRequest } from '@prepaid-shield/shared-types';
import type { BusinessTabProps } from '../../navigation/types';

type QrPaymentModel = 'monthly' | 'voucher';

type DateInputProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
};

function monthsBetweenDates(from: string, until: string): number {
  const start = new Date(from);
  const end = new Date(until);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;
  const monthDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(1, monthDiff || 1);
}

function normalizeDateInput(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length !== 8) return trimmed;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function WebDateInput({ label, value, placeholder, onChangeText }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = useCallback(() => {
    const input = inputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (input?.showPicker) {
      input.showPicker();
      return;
    }
    input?.focus();
  }, []);

  return React.createElement(
    'label',
    {
      'aria-label': `${label} 선택`,
      onClick: openPicker,
      style: StyleSheet.flatten([styles.dateField, styles.webDateField]) as any,
    },
    React.createElement(
      'span',
      { style: StyleSheet.flatten([styles.dateDisplayText, !value && styles.datePlaceholder]) as any },
      value || placeholder,
    ),
    React.createElement('input', {
      ref: inputRef,
      type: 'date',
      value,
      placeholder,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChangeText(normalizeDateInput(event.target.value)),
      onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => {
        event.preventDefault();
        onChangeText(normalizeDateInput(event.clipboardData.getData('text')));
      },
      style: StyleSheet.flatten(styles.webNativeDateInput) as any,
    }),
  );
}

function NativeDateInput({ label, value, placeholder, onChangeText }: DateInputProps) {
  const inputRef = useRef<TextInput>(null);

  return (
    <TouchableOpacity
      accessibilityLabel={`${label} 선택`}
      accessibilityRole="button"
      activeOpacity={0.85}
      onPress={() => inputRef.current?.focus()}
      style={styles.dateField}
    >
      <TextInput
        {...({ type: 'date' } as any)}
        ref={inputRef}
        inputMode="none"
        style={styles.dateTextInput}
        placeholder={placeholder}
        placeholderTextColor={colors.gray400}
        value={value}
        onChangeText={(nextValue) => onChangeText(normalizeDateInput(nextValue))}
      />
    </TouchableOpacity>
  );
}

function DateInput(props: DateInputProps) {
  return Platform.OS === 'web' ? <WebDateInput {...props} /> : <NativeDateInput {...props} />;
}

export function BusinessCreatePaymentScreen({ navigation }: BusinessTabProps<'BusinessCreatePayment'>) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const [qrPaymentModel, setQrPaymentModel] = useState<QrPaymentModel>('monthly');
  const [qrPaymentAmount, setQrPaymentAmount] = useState('');
  const [qrProtectedAmount, setQrProtectedAmount] = useState('');
  const [qrMonths, setQrMonths] = useState('6');
  const [qrValidFrom, setQrValidFrom] = useState('');
  const [qrValidUntil, setQrValidUntil] = useState('');
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);

  const paymentRequestMutation = useMutation({
    mutationFn: () => {
      const paymentAmount = krwToRlusd(qrPaymentAmount);
      if (qrPaymentModel === 'voucher') {
        const totalAmount = krwToRlusd(qrProtectedAmount);
        const validFrom = normalizeDateInput(qrValidFrom);
        const validUntil = normalizeDateInput(qrValidUntil);
        const validityMonths = monthsBetweenDates(validFrom, validUntil);
        return api.createPaymentRequest({
          businessId: userId!,
          paymentAmount,
          totalAmount,
          paymentModel: 'voucher',
          escrowType: 'prepaid',
          unitPrice: roundRlusd(totalAmount / 10),
          validityMonths,
          validFrom,
          validUntil,
        });
      }
      const months = Number(qrMonths);
      return api.createPaymentRequest({
        businessId: userId!,
        paymentAmount,
        totalAmount: paymentAmount,
        monthlyAmount: months > 0 ? roundRlusd(paymentAmount / months) : 0,
        months,
        paymentModel: 'monthly',
        escrowType: 'monthly',
      });
    },
    onSuccess: (request) => {
      setPaymentRequest(request);
      queryClient.invalidateQueries({ queryKey: ['businessDashboard'] });
      showSuccessToast('결제 QR 생성', '손님이 QR 코드를 스캔하면 계좌 승인 결제를 시작합니다.');
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      showErrorToast('QR 생성 실패', apiErr.userMessage ?? err.message);
    },
  });

  const submitPaymentRequest = useCallback(() => {
    const paymentAmount = krwToRlusd(qrPaymentAmount);
    const isMonthlyReady = qrPaymentModel === 'monthly' && Number(qrMonths) > 0;
    const isVoucherReady = qrPaymentModel === 'voucher'
      && krwToRlusd(qrProtectedAmount) > 0
      && monthsBetweenDates(normalizeDateInput(qrValidFrom), normalizeDateInput(qrValidUntil)) > 0;
    if (paymentAmount <= 0 || (!isMonthlyReady && !isVoucherReady)) {
      showErrorToast('QR 생성 실패', '결제 금액, 실제 충전 금액, 정산 조건을 입력해주세요.');
      return;
    }
    paymentRequestMutation.mutate();
  }, [paymentRequestMutation, qrMonths, qrPaymentAmount, qrPaymentModel, qrProtectedAmount, qrValidFrom, qrValidUntil]);

  const previewAmount = krwToRlusd(qrPaymentAmount);
  const protectedPreviewAmount = krwToRlusd(qrProtectedAmount);
  const monthlyPreview = qrPaymentModel === 'monthly' && Number(qrMonths) > 0
    ? previewAmount / Number(qrMonths)
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heroCard}>
        <TouchableOpacity
          accessibilityLabel="대시보드로 뒤로 가기"
          accessibilityRole="button"
          activeOpacity={0.75}
          onPress={() => navigation.navigate('Dashboard')}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>사업자 결제 생성</Text>
        <Text style={styles.title}>결제 QR 만들기</Text>
        <Text style={styles.desc}>사업자가 결제 내용을 먼저 만들고, 손님은 QR을 스캔해 계좌 승인만 합니다.</Text>
      </View>

      <View style={styles.formCard}>
        <View style={styles.qrModeRow}>
          {(['monthly', 'voucher'] as QrPaymentModel[]).map((model) => (
            <TouchableOpacity
              key={model}
              style={[styles.qrModeButton, qrPaymentModel === model && styles.qrModeButtonActive]}
              onPress={() => setQrPaymentModel(model)}
              activeOpacity={0.8}
            >
              <Text style={[styles.qrModeText, qrPaymentModel === model && styles.qrModeTextActive]}>
                {model === 'monthly' ? '월정액' : '기간 금액권'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {qrPaymentModel === 'monthly' ? (
          <>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>결제 금액</Text>
                <TextInput
                  style={styles.input}
                  placeholder="예: 810,000"
                  placeholderTextColor={colors.gray400}
                  keyboardType="number-pad"
                  value={qrPaymentAmount}
                  onChangeText={setQrPaymentAmount}
                />
              </View>
              <View style={styles.monthsGroup}>
                <Text style={styles.inputLabel}>개월</Text>
                <TextInput
                  style={styles.input}
                  placeholder="예: 6"
                  placeholderTextColor={colors.gray400}
                  keyboardType="number-pad"
                  value={qrMonths}
                  onChangeText={setQrMonths}
                />
              </View>
            </View>
            {monthlyPreview > 0 && (
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>월별 자동 정산 예정액</Text>
                <Text style={styles.previewValue}>{formatKrwFromRlusd(monthlyPreview)}</Text>
                <Text style={styles.previewSub}>{formatRlusd(monthlyPreview)}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>결제 금액</Text>
                <TextInput
                  style={styles.input}
                  placeholder="예: 90,000"
                  placeholderTextColor={colors.gray400}
                  keyboardType="number-pad"
                  value={qrPaymentAmount}
                  onChangeText={setQrPaymentAmount}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>실제 충전 금액</Text>
                <TextInput
                  style={styles.input}
                  placeholder="예: 100,000"
                  placeholderTextColor={colors.gray400}
                  keyboardType="number-pad"
                  value={qrProtectedAmount}
                  onChangeText={setQrProtectedAmount}
                />
              </View>
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>사용 시작일</Text>
                <DateInput
                  label="사용 시작일"
                  placeholder="예: 2026-05-13"
                  value={qrValidFrom}
                  onChangeText={setQrValidFrom}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>사용 종료일</Text>
                <DateInput
                  label="사용 종료일"
                  placeholder="예: 2026-08-13"
                  value={qrValidUntil}
                  onChangeText={setQrValidUntil}
                />
              </View>
            </View>
            {protectedPreviewAmount > 0 && (
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>보호 원장 충전액</Text>
                <Text style={styles.previewValue}>{formatKrwFromRlusd(protectedPreviewAmount)}</Text>
                <Text style={styles.previewSub}>{formatRlusd(protectedPreviewAmount)}</Text>
              </View>
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.submitButton, paymentRequestMutation.isPending && styles.buttonDisabled]}
          onPress={submitPaymentRequest}
          disabled={paymentRequestMutation.isPending}
          activeOpacity={0.85}
        >
          <Text style={styles.submitButtonText}>QR 결제 만들기</Text>
        </TouchableOpacity>
      </View>

      {paymentRequest && (
        <View style={styles.generatedQrBox}>
          <PaymentRequestQrCode code={paymentRequest.code} />
          <View style={styles.generatedQrInfo}>
            <Text style={styles.generatedQrLabel}>손님에게 보여줄 실제 결제 QR</Text>
            <Text style={styles.generatedQrCode}>{paymentRequest.code}</Text>
            <Text style={styles.generatedQrHint}>QR 코드나 결제 코드를 손님에게 보여주세요.</Text>
            <Text style={styles.generatedQrHint}>손님 승인 후 대시보드와 내역에 자동 반영됩니다.</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.full,
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
    minWidth: 36,
    minHeight: 36,
  },
  backIcon: {
    color: colors.white,
    fontSize: 24,
    lineHeight: 26,
  },
  eyebrow: {
    fontSize: font.size.xs,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: font.weight.bold,
    marginBottom: spacing.xs,
  },
  title: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.white, letterSpacing: -0.4 },
  desc: { fontSize: font.size.sm, color: 'rgba(255,255,255,0.78)', lineHeight: 20, marginTop: spacing.sm },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  qrModeRow: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
    gap: 4,
  },
  qrModeButton: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  qrModeButtonActive: {
    backgroundColor: colors.white,
    ...shadow.sm,
  },
  qrModeText: { fontSize: font.size.sm, color: colors.gray500, fontWeight: font.weight.semibold },
  qrModeTextActive: { color: colors.primary },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  inputGroup: { flex: 1 },
  monthsGroup: { width: 88 },
  inputLabel: {
    fontSize: font.size.xs,
    color: colors.gray600,
    fontWeight: font.weight.semibold,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    fontSize: font.size.md,
    color: colors.gray900,
  },
  dateField: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    minHeight: Platform.OS === 'ios' ? 49 : 42,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dateTextInput: {
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    fontSize: font.size.md,
    color: colors.gray900,
  },
  dateDisplayText: {
    display: 'block',
    padding: spacing.md,
    fontSize: font.size.md,
    color: colors.gray900,
  } as any,
  datePlaceholder: { color: colors.gray400 } as any,
  webDateField: {
    position: 'relative',
    cursor: 'pointer',
    boxSizing: 'border-box',
  } as any,
  webNativeDateInput: {
    position: 'absolute',
    inset: 0,
    opacity: 0,
    width: '100%',
    height: '100%',
    cursor: 'pointer',
  } as any,
  previewBox: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  previewLabel: { fontSize: font.size.xs, color: colors.gray500, marginBottom: 2 },
  previewValue: { fontSize: font.size.lg, color: colors.gray900, fontWeight: font.weight.bold },
  previewSub: { fontSize: font.size.xs, color: colors.gray400, marginTop: 1 },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitButtonText: { color: colors.white, fontWeight: font.weight.semibold, fontSize: font.size.sm },
  buttonDisabled: { opacity: 0.5 },
  generatedQrBox: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
    ...shadow.sm,
  },
  generatedQrInfo: { flex: 1 },
  generatedQrLabel: { fontSize: font.size.xs, color: colors.gray500, marginBottom: 2 },
  generatedQrCode: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.gray900,
    fontFamily: font.mono,
    textAlign: 'center',
  },
  generatedQrHint: { fontSize: font.size.xs, color: colors.gray500, marginTop: spacing.xs, lineHeight: 18, textAlign: 'center' },
});
