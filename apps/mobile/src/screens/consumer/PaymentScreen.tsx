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
  const { businessId, businessName, businessCategory } = route.params;
  const defaultEscrowType = getDefaultEscrowType(businessCategory);

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

  const amountValue = Number(amount);
  const monthsValue = Number(months);
  const unitPriceValue = Number(unitPrice);
  const validityMonthsValue = Number(validityMonths);
  const effectiveEscrowType = selectedProduct?.escrowType ?? escrowType;
  const effectiveAmount = selectedProduct?.totalAmount ?? amountValue;
  const effectiveMonths = selectedProduct?.months ?? monthsValue;
  const effectiveUnitPrice = selectedProduct?.unitPrice ?? unitPriceValue;
  const effectiveValidityMonths = selectedProduct?.validityMonths ?? validityMonthsValue;
  const prepaidEntryCount = effectiveAmount > 0 && effectiveUnitPrice && effectiveUnitPrice > 0 ? effectiveAmount / effectiveUnitPrice : 0;
  const isPrepaidDivisible = Number.isInteger(prepaidEntryCount);
  const canSubmit = selectedProduct ? true : escrowType === 'monthly'
    ? !!amount && !!months
    : !!amount && !!unitPrice && !!validityMonths && isPrepaidDivisible;

  const mutation = useMutation({
    mutationFn: () =>
      api.createEscrow({
        consumerId: userId!,
        businessId,
        ...(selectedProduct ? { productId: selectedProduct.id } : {}),
        totalAmount: effectiveAmount,
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
      showSuccessToast('에스크로 생성 완료', 'XRPL에 에스크로가 생성되었습니다!');
      navigation.navigate('ConsumerTabs', { screen: 'Home' });
    },
    onError: (err: Error) => {
      const apiErr = err as import('../../api/client').ApiError;
      showErrorToast('에스크로 생성 실패', apiErr.userMessage ?? err.message);
    },
  });

  const monthlyAmount = effectiveAmount && effectiveMonths ? (effectiveAmount / effectiveMonths).toFixed(2) : '0';
  const prepaidSummary = effectiveAmount && effectiveUnitPrice && isPrepaidDivisible
    ? `${prepaidEntryCount}개 단위 x ${effectiveUnitPrice} RLUSD`
    : '이용 횟수를 계산할 수 없습니다';

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

        {!!products.length && (
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
                    <Text style={styles.productAmount}>{product.totalAmount.toLocaleString()} RLUSD</Text>
                  </View>
                  {!!product.description && <Text style={styles.productDesc}>{product.description}</Text>}
                  <Text style={styles.productMeta}>
                    {product.escrowType === 'monthly'
                      ? `${product.months ?? 0}개월 · 월 ${product.monthlyAmount.toLocaleString()} RLUSD 정산`
                      : `${product.validityMonths ?? 0}개월 · ${product.unitPrice?.toLocaleString() ?? product.monthlyAmount.toLocaleString()} RLUSD 단위 보호`}
                  </Text>
                  {!!product.menuItems?.length && (
                    <View style={styles.menuList}>
                      {product.menuItems.map((menu) => (
                        <Text key={menu.id} style={styles.menuPill}>{menu.name} {menu.amount.toLocaleString()} RLUSD</Text>
                      ))}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.formCard}>
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
            <Text style={styles.label}>총 금액 (RLUSD)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder={effectiveEscrowType === 'prepaid' ? '예: 150' : '예: 600'}
              placeholderTextColor={colors.gray400}
            />
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
                <Text style={styles.label}>1회 이용금액 (RLUSD)</Text>
                <TextInput
                  style={styles.input}
                  value={unitPrice}
                  onChangeText={setUnitPrice}
                  keyboardType="numeric"
                  placeholder="예: 5"
                  placeholderTextColor={colors.gray400}
                />
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
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>{effectiveEscrowType === 'monthly' ? '월별 릴리즈 금액' : '보호 단위'}</Text>
          <Text style={styles.infoValue}>{effectiveEscrowType === 'monthly' ? `${monthlyAmount} RLUSD` : prepaidSummary}</Text>
          <View style={styles.infoDivider} />
          {effectiveEscrowType === 'monthly' ? (
            <>
              <Text style={styles.infoDesc}>
                총액은 {effectiveMonths || '0'}개의 Token Escrow로 나뉘어 잠기고, finishAfter 이후 매월 {monthlyAmount} RLUSD가 {businessName}에게 릴리즈됩니다
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
              <Text style={styles.buttonText}> XRPL에 생성 중...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>에스크로 생성</Text>
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
  productAmount: {
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    color: colors.primary,
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
  menuList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  menuPill: {
    fontSize: font.size.xs,
    color: colors.primary,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
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
