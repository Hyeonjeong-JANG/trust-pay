import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
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
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { formatKrw, formatKrwFromRlusd, formatRlusd, getWholeUnitCount, krwToRlusd, parseKrwInput, rlusdToKrw, roundRlusd } from '../../utils/money';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { ScreenProps } from '../../navigation/types';
import type { BusinessProduct, EscrowType } from '@prepaid-shield/shared-types';

const MONTHLY_CATEGORY_KEYWORDS = ['헬스장', '피트니스', '학원', '어학원', '독서실', '스터디카페', '필라테스', '요가'];
const PREPAID_CATEGORY_KEYWORDS = ['카페', '미용실', '네일', '피부관리', '에스테틱', '마사지', '세탁', 'PT', '피티', '레슨'];

function getDefaultEscrowType(businessCategory?: string): EscrowType {
  if (!businessCategory) return 'monthly';
  const normalizedCategory = businessCategory.trim().toUpperCase();
  if (MONTHLY_CATEGORY_KEYWORDS.some((keyword) => normalizedCategory.includes(keyword))) return 'monthly';
  return PREPAID_CATEGORY_KEYWORDS.some((keyword) => normalizedCategory.includes(keyword))
    ? 'prepaid'
    : 'monthly';
}

export function PaymentScreen({ route, navigation }: ScreenProps<'Payment'>) {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const { businessId, businessName, businessCategory, paymentRequest } = route.params;
  const isRequestCheckout = !!paymentRequest;
  const defaultEscrowType = paymentRequest?.escrowType ?? getDefaultEscrowType(businessCategory);

  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState('6');
  const [escrowType, setEscrowType] = useState<EscrowType>(defaultEscrowType);
  const [unitPrice, setUnitPrice] = useState('');
  const [validityMonths, setValidityMonths] = useState(defaultEscrowType === 'prepaid' ? '3' : '');
  const [selectedProduct, setSelectedProduct] = useState<BusinessProduct | null>(null);
  const [products, setProducts] = useState<BusinessProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(api.getBusinessProducts(businessId))
      .then((data) => {
        if (!cancelled && data.length > 0) setProducts(data);
      })
      .catch(() => {
        // Product catalog is optional; manual escrow input remains available.
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const amountValue = parseKrwInput(amount);
  const monthsValue = Number(months);
  const unitPriceValue = parseKrwInput(unitPrice);
  const validityMonthsValue = Number(validityMonths);
  const effectiveEscrowType = paymentRequest?.escrowType ?? selectedProduct?.escrowType ?? escrowType;
  const effectiveAmount = paymentRequest?.totalAmount ?? selectedProduct?.totalAmount ?? krwToRlusd(amountValue);
  const effectiveMonths = paymentRequest?.months ?? selectedProduct?.months ?? monthsValue;
  const effectiveUnitPrice = paymentRequest?.unitPrice ?? selectedProduct?.unitPrice ?? krwToRlusd(unitPriceValue);
  const effectiveValidityMonths = paymentRequest?.validityMonths ?? selectedProduct?.validityMonths ?? validityMonthsValue;
  const effectiveAmountKrw = paymentRequest ? rlusdToKrw(paymentRequest.totalAmount) : selectedProduct ? rlusdToKrw(selectedProduct.totalAmount) : amountValue;
  const effectiveUnitPriceKrw = paymentRequest && effectiveUnitPrice ? rlusdToKrw(effectiveUnitPrice) : selectedProduct && effectiveUnitPrice ? rlusdToKrw(effectiveUnitPrice) : unitPriceValue;
  const prepaidEntryCount = getWholeUnitCount(effectiveAmountKrw, effectiveUnitPriceKrw);
  const isPrepaidDivisible = prepaidEntryCount !== null;
  const canSubmit = paymentRequest ? true : selectedProduct ? true : escrowType === 'monthly'
    ? amountValue > 0 && !!months
    : amountValue > 0 && unitPriceValue > 0 && !!validityMonths && isPrepaidDivisible;
  const payloadTotalAmount = effectiveEscrowType === 'prepaid' && effectiveUnitPrice && prepaidEntryCount
    ? roundRlusd(effectiveUnitPrice * prepaidEntryCount)
    : effectiveAmount;

  const mutation = useMutation({
    mutationFn: () =>
      api.createEscrow({
        consumerId: userId!,
        businessId,
        ...(paymentRequest?.productId ? { productId: paymentRequest.productId } : selectedProduct ? { productId: selectedProduct.id } : {}),
        totalAmount: payloadTotalAmount,
        ...(effectiveEscrowType === 'monthly'
          ? { months: effectiveMonths }
          : {
              escrowType: 'prepaid' as const,
              unitPrice: effectiveUnitPrice ?? undefined,
              validityMonths: effectiveValidityMonths ?? undefined,
            }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumerEscrows'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      showSuccessToast('보호 결제 시작 완료', '계좌 승인 후 XRPL 보호 원장에 잠깁니다.');
      navigation.navigate('ConsumerTabs', { screen: 'Home' });
    },
    onError: (err: Error) => {
      const apiErr = err as import('../../api/client').ApiError;
      showErrorToast('보호 결제 시작 실패', apiErr.userMessage ?? err.message);
    },
  });

  const monthlyAmount = effectiveAmount && effectiveMonths ? effectiveAmount / effectiveMonths : 0;
  const monthlyAmountKrw = effectiveAmountKrw && effectiveMonths ? effectiveAmountKrw / effectiveMonths : 0;
  const prepaidSummary = effectiveAmountKrw && effectiveUnitPriceKrw && isPrepaidDivisible
    ? `${prepaidEntryCount}개 단위 x ${formatKrw(effectiveUnitPriceKrw)}`
    : '이용 횟수를 계산할 수 없습니다';
  const infoSecondary = effectiveEscrowType === 'monthly'
    ? formatRlusd(monthlyAmount)
    : effectiveUnitPrice
      ? formatRlusd(effectiveUnitPrice)
      : formatRlusd(0);

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

        {paymentRequest && (
          <View style={styles.requestCard}>
            <Text style={styles.requestEyebrow}>사업자가 만든 결제 QR</Text>
            <Text style={styles.requestTitle}>QR 코드 {paymentRequest.code}</Text>
            <Text style={styles.requestDesc}>
              {businessName}에서 생성한 결제 내용입니다. 금액을 확인한 뒤 계좌 승인으로 보호 결제를 시작하세요.
            </Text>
            <View style={styles.requestAmountGrid}>
              <Text style={styles.requestAmountText}>
                결제 금액 {formatKrwFromRlusd(paymentRequest.paymentAmount ?? paymentRequest.totalAmount)}
              </Text>
              {paymentRequest.paymentModel === 'voucher' && (
                <Text style={styles.requestAmountText}>
                  실제 충전 금액 {formatKrwFromRlusd(paymentRequest.totalAmount)}
                </Text>
              )}
            </View>
            <Text style={styles.requestSettlementText}>
              {paymentRequest.paymentModel === 'voucher'
                ? `사용기간 ${paymentRequest.validFrom ?? '-'} ~ ${paymentRequest.validUntil ?? '-'}`
                : `매월 ${formatKrwFromRlusd(paymentRequest.monthlyAmount ?? monthlyAmount)} 정산`}
            </Text>
          </View>
        )}

        <View style={styles.protectionCard}>
          <Text style={styles.protectionEyebrow}>TrustPay 계좌 승인으로 결제</Text>
          <Text style={styles.protectionTitle}>카카오페이처럼 앱에서 승인하면 선불금이 보호됩니다</Text>
          <View style={styles.protectionRow}>
            <Text style={styles.protectionBadge}>메인</Text>
            <Text style={styles.protectionText}>연결 계좌에서 앱 승인 후 선불금이 XRPL 보호 원장에 잠깁니다</Text>
          </View>
          <View style={styles.protectionRow}>
            <Text style={[styles.protectionBadge, styles.protectionBadgeMuted]}>보조</Text>
            <Text style={styles.protectionText}>카드는 보조 옵션이며 현금이나 가게 단말기 직접 결제는 보호 대상이 아닙니다</Text>
          </View>
        </View>

        {!isRequestCheckout && !!products.length && (
          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>등록 상품 선택</Text>
            {products.map((product) => {
              const isSelected = selectedProduct?.id === product.id;
              return (
                <Pressable
                  key={product.id}
                  style={[styles.productCard, isSelected && styles.productCardActive]}
                  onPress={() => setSelectedProduct(product)}
                >
                  <View style={styles.productHeader}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <View style={styles.productAmountBlock}>
                      <Text style={styles.productAmount}>{formatKrwFromRlusd(product.totalAmount)}</Text>
                      <Text style={styles.productAmountSub}>{formatRlusd(product.totalAmount)}</Text>
                    </View>
                  </View>
                  {!!product.description && <Text style={styles.productDesc}>{product.description}</Text>}
                  <Text style={styles.productMeta}>
                    {product.escrowType === 'monthly'
                      ? `${product.months ?? 0}개월 · 월 ${formatKrwFromRlusd(product.monthlyAmount)} 정산`
                      : `${product.validityMonths ?? 0}개월 · ${formatKrwFromRlusd(product.unitPrice ?? product.monthlyAmount)} 단위 보호`}
                  </Text>
                  <Text style={styles.productMetaSub}>
                    {product.escrowType === 'monthly'
                      ? formatRlusd(product.monthlyAmount)
                      : formatRlusd(product.unitPrice ?? product.monthlyAmount)}
                  </Text>
                  {!!product.menuItems?.length && (
                    <View style={styles.menuList}>
                      {product.menuItems.map((menu) => (
                        <View key={menu.id} style={styles.menuPill}>
                          <Text style={styles.menuPillText}>{menu.name} {formatKrwFromRlusd(menu.amount)}</Text>
                          <Text style={styles.menuPillSub}>{formatRlusd(menu.amount)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {!isRequestCheckout && <View style={styles.formCard}>
          <View style={styles.typeRow}>
            {(['monthly', 'prepaid'] as EscrowType[]).map((type) => (
              <Pressable
                key={type}
                style={[styles.typeButton, effectiveEscrowType === type && styles.typeButtonActive]}
                onPress={() => {
                  setSelectedProduct(null);
                  setEscrowType(type);
                }}
              >
                <Text style={[styles.typeButtonText, effectiveEscrowType === type && styles.typeButtonTextActive]}>
                  {type === 'monthly' ? '월정액' : '이용권'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>총 금액 (원)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder={effectiveEscrowType === 'prepaid' ? '예: 202,500' : '예: 810,000'}
              placeholderTextColor={colors.gray400}
            />
            {!!amountValue && <Text style={styles.inputHint}>{formatRlusd(effectiveAmount)}</Text>}
          </View>

          {effectiveEscrowType === 'monthly' ? (
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
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>1회 이용금액 (원)</Text>
                <TextInput
                  style={styles.input}
                  value={unitPrice}
                  onChangeText={setUnitPrice}
                  keyboardType="numeric"
                  placeholder="예: 6,750"
                  placeholderTextColor={colors.gray400}
                />
                {!!unitPriceValue && <Text style={styles.inputHint}>{formatRlusd(effectiveUnitPrice)}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>유효기간 (개월)</Text>
                <TextInput
                  style={styles.input}
                  value={validityMonths}
                  onChangeText={setValidityMonths}
                  keyboardType="numeric"
                  placeholder="예: 3"
                  placeholderTextColor={colors.gray400}
                />
              </View>
            </>
          )}
        </View>}

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>{effectiveEscrowType === 'monthly' ? '월별 릴리즈 금액' : '보호 단위'}</Text>
          <Text style={styles.infoValue}>{effectiveEscrowType === 'monthly' ? `월 ${formatKrw(monthlyAmountKrw)}` : prepaidSummary}</Text>
          <Text style={styles.infoSecondary}>{infoSecondary}</Text>
          <View style={styles.infoDivider} />
          {effectiveEscrowType === 'monthly' ? (
            <>
              <Text style={styles.infoDesc}>
                총액은 {effectiveMonths || '0'}개의 Token Escrow로 나뉘어 잠기고, finishAfter 이후 매월 {formatKrw(monthlyAmountKrw)}가 {businessName}에게 릴리즈됩니다
              </Text>
              <Text style={styles.infoHint}>취소 시 아직 대기 중인 월차는 소비자에게 환불됩니다</Text>
            </>
          ) : (
            <>
              <Text style={styles.infoDesc}>
                메뉴 금액만큼 여러 Token Escrow 단위를 묶어 사업자가 차감 요청하고, 소비자 승인 후에만 정산됩니다
              </Text>
              <Text style={styles.infoHint}>유효기간: {effectiveValidityMonths || '0'}개월 · 미사용 이용권은 만료 후 환불 대상입니다</Text>
            </>
          )}
        </View>

        <Pressable
          style={[styles.button, (mutation.isPending || !canSubmit) && styles.buttonDisabled]}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending || !canSubmit}
        >
          {mutation.isPending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.buttonText}> 보호 결제 준비 중...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>계좌 승인 결제 요청</Text>
          )}
        </Pressable>
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
  requestCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  requestEyebrow: {
    fontSize: font.size.xs,
    color: colors.primary,
    fontWeight: font.weight.bold,
    marginBottom: spacing.xs,
  },
  requestTitle: {
    fontSize: font.size.lg,
    color: colors.gray900,
    fontWeight: font.weight.bold,
    marginBottom: spacing.xs,
  },
  requestDesc: {
    fontSize: font.size.sm,
    color: colors.gray600,
    lineHeight: 20,
  },
  requestAmountGrid: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  requestAmountText: {
    fontSize: font.size.sm,
    color: colors.gray900,
    fontWeight: font.weight.semibold,
  },
  requestSettlementText: {
    fontSize: font.size.sm,
    color: colors.primaryDark,
    fontWeight: font.weight.bold,
    marginTop: spacing.sm,
  },
  protectionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  protectionEyebrow: {
    fontSize: font.size.xs,
    color: colors.primary,
    fontWeight: font.weight.bold,
    marginBottom: spacing.xs,
  },
  protectionTitle: {
    fontSize: font.size.md,
    color: colors.gray900,
    fontWeight: font.weight.bold,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  protectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  protectionBadge: {
    minWidth: 48,
    textAlign: 'center',
    fontSize: font.size.xs,
    color: colors.primary,
    fontWeight: font.weight.bold,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  protectionBadgeMuted: {
    color: colors.gray500,
    backgroundColor: colors.gray100,
  },
  protectionText: {
    flex: 1,
    fontSize: font.size.sm,
    color: colors.gray600,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.gray700,
    marginBottom: spacing.md,
  },
  productCard: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.gray50,
  },
  productCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  productName: {
    flex: 1,
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.gray900,
  },
  productAmountBlock: { alignItems: 'flex-end' },
  productAmount: {
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    color: colors.primary,
  },
  productAmountSub: {
    fontSize: font.size.xs,
    color: colors.gray400,
    marginTop: 1,
  },
  productDesc: {
    fontSize: font.size.sm,
    color: colors.gray500,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  productMeta: {
    fontSize: font.size.xs,
    color: colors.gray500,
    fontWeight: font.weight.semibold,
    marginTop: spacing.sm,
  },
  productMetaSub: {
    fontSize: font.size.xs,
    color: colors.gray400,
    marginTop: 2,
  },
  menuList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  menuPill: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  menuPillText: {
    fontSize: font.size.xs,
    color: colors.primary,
    fontWeight: font.weight.semibold,
  },
  menuPillSub: {
    fontSize: 10,
    color: colors.gray400,
    marginTop: 1,
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.gray100,
    alignItems: 'center',
  },
  typeButtonActive: { backgroundColor: colors.primary },
  typeButtonText: {
    fontSize: font.size.sm,
    color: colors.gray500,
    fontWeight: font.weight.semibold,
  },
  typeButtonTextActive: { color: colors.white },
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
  inputHint: {
    fontSize: font.size.xs,
    color: colors.gray400,
    marginTop: spacing.xs,
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
  infoSecondary: {
    fontSize: font.size.sm,
    color: colors.gray500,
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
  infoHint: {
    fontSize: font.size.xs,
    color: colors.primary,
    fontWeight: font.weight.medium,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: spacing.sm,
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
