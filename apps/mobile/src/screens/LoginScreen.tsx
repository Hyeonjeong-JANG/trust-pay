import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { AppMessageModal, type AppMessageTone } from '../components/AppMessageModal';
import { useAuthStore } from '../store/auth';
import { colors, spacing, radius, font, shadow } from '../theme';

type UserRole = 'consumer' | 'business';

const isWeb = Platform.OS === 'web';

function normalizePhone(identifier: string) {
  return identifier.replace(/\D/g, '');
}

function authPayloadFromIdentifier(identifier: string, role: UserRole) {
  const value = identifier.trim();
  return {
    ...(value.includes('@') ? { email: value } : { phone: normalizePhone(value) }),
    role,
  };
}

function PrimaryActionButton({
  label,
  loadingLabel,
  disabled,
  loading,
  onPress,
}: {
  label: string;
  loadingLabel: string;
  disabled: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  if (isWeb) {
    return React.createElement(
      'button',
      {
        type: 'button',
        disabled,
        onClick: onPress,
        style: {
          width: '100%',
          backgroundColor: colors.primary,
          color: colors.white,
          border: 0,
          borderRadius: radius.md,
          padding: `${spacing.md}px`,
          marginTop: spacing.sm,
          fontSize: font.size.md,
          fontWeight: font.weight.semibold,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        },
      },
      loading ? loadingLabel : label,
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.buttonText}> {loadingLabel}</Text>
        </View>
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [role, setRole] = useState<UserRole>('consumer');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isNewConsumer, setIsNewConsumer] = useState(false);
  const [isNewBusiness, setIsNewBusiness] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
  const [isBusinessNumberVerified, setBusinessNumberVerified] = useState(false);
  const [businessVerificationLabel, setBusinessVerificationLabel] = useState('데모 국세청 인증 완료');
  const [messageModal, setMessageModal] = useState<{ title: string; message: string; tone: AppMessageTone } | null>(null);

  const authPayload = () => authPayloadFromIdentifier(identifier, role);
  const showMessage = (title: string, message: string, tone: AppMessageTone = 'danger') => {
    setMessageModal({ title, message, tone });
  };

  const resetCode = () => {
    setCode('');
    setCodeSent(false);
    setIsNewConsumer(false);
    setIsNewBusiness(false);
    setBusinessNumberVerified(false);
    setBusinessVerificationLabel('데모 국세청 인증 완료');
  };

  const businessRegistrationDigits = businessRegistrationNumber.replace(/\D/g, '');

  const requestCodeMutation = useMutation({
    mutationFn: () => api.requestCode(authPayload()),
    onSuccess: (data) => {
      setIsNewConsumer(role === 'consumer' && data.isNewUser === true);
      setIsNewBusiness(role === 'business' && data.isNewUser === true);
      setCodeSent(true);
    },
    onError: (err: Error) => {
      const apiErr = err as import('../api/client').ApiError;
      const title = apiErr.code === 'NETWORK' ? '네트워크 오류' : '인증코드 요청 실패';
      showMessage(title, apiErr.userMessage ?? err.message);
    },
  });

  const verifyBusinessRegistrationMutation = useMutation({
    mutationFn: () => api.verifyBusinessRegistrationNumber({ registrationNumber: businessRegistrationDigits }),
    onSuccess: (data) => {
      if (data.status === 'unavailable') {
        setBusinessNumberVerified(false);
        showMessage('사업자등록번호 인증 실패', data.message);
        return;
      }
      setBusinessNumberVerified(true);
      setBusinessVerificationLabel(data.status === 'verified' ? '국세청 인증 완료' : '데모 국세청 인증 완료');
    },
    onError: (err: Error) => {
      const apiErr = err as import('../api/client').ApiError;
      showMessage('사업자등록번호 인증 실패', apiErr.userMessage ?? err.message);
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async () => {
      if (role === 'business' && isNewBusiness) {
        const payload = authPayload();
        await api.registerBusiness({
          name: businessName.trim(),
          category: businessCategory.trim(),
          address: businessAddress.trim(),
          phone: 'phone' in payload ? payload.phone : undefined,
          email: 'email' in payload ? payload.email : undefined,
          registrationNumber: businessRegistrationDigits,
        });
      }
      return api.verifyCode({ ...authPayload(), code });
    },
    onSuccess: (data) => {
      setAuth(data.role, data.userId, data.name, data.token);
    },
    onError: (err: Error) => {
      const apiErr = err as import('../api/client').ApiError;
      const title = apiErr.code === 'NETWORK' ? '네트워크 오류' : '로그인 실패';
      showMessage(title, apiErr.userMessage ?? err.message);
    },
  });

  const trimmedIdentifier = identifier.trim();
  const isEmailIdentifier = trimmedIdentifier.includes('@');
  const isMobilePhoneValid = /^01[016789]-?\d{3,4}-?\d{4}$/.test(trimmedIdentifier);
  const isLandlinePhoneValid = /^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(trimmedIdentifier);
  const isPhoneValid = role === 'business'
    ? isMobilePhoneValid || isLandlinePhoneValid
    : isMobilePhoneValid;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedIdentifier);
  const canSubmit = isEmailIdentifier ? isEmailValid : isPhoneValid;
  const canVerify = canSubmit && /^\d{6}$/.test(code);
  const canSubmitBusinessSignup = !isNewBusiness || (
    businessName.trim().length > 0
    && businessCategory.trim().length > 0
    && businessAddress.trim().length > 0
    && businessRegistrationDigits.length === 10
    && isBusinessNumberVerified
  );
  const isPending = requestCodeMutation.isPending || verifyCodeMutation.isPending || verifyBusinessRegistrationMutation.isPending;

  const handleSubmit = () => {
    if (codeSent) {
      verifyCodeMutation.mutate();
    } else {
      requestCodeMutation.mutate();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>TP</Text>
          </View>
          <Text style={styles.title}>TrustPay</Text>
          <Text style={styles.subtitle}>원화 우선 선불 보호 서비스</Text>
        </View>

        <View style={styles.formCard}>
          {/* 역할 선택 */}
          <View style={styles.segmentRow}>
            {(['consumer', 'business'] as UserRole[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.segment, role === r && styles.segmentActive]}
                onPress={() => {
                  setRole(r);
                  resetCode();
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.segmentIcon, role === r && styles.segmentIconActive]}>
                  {r === 'consumer' ? '👤' : '🏪'}
                </Text>
                <Text style={[styles.segmentText, role === r && styles.segmentTextActive]}>
                  {r === 'consumer' ? '소비자' : '사업자'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 입력 필드 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>전화번호 또는 이메일</Text>
            <TextInput
              style={[styles.input, identifier && !canSubmit && styles.inputError]}
              value={identifier}
              onChangeText={(value) => {
                setIdentifier(value);
                resetCode();
              }}
              placeholder="전화번호 또는 이메일"
              placeholderTextColor={colors.gray400}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {codeSent && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>인증코드</Text>
              <TextInput
                style={[styles.input, code && !canVerify && styles.inputError]}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={colors.gray400}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
          )}

          {codeSent && isNewConsumer && (
            <View style={styles.signupNotice}>
              <Text style={styles.signupNoticeTitle}>처음 이용하는 번호예요</Text>
              <Text style={styles.signupNoticeText}>
                인증하면 새 TrustPay 소비자 계정이 만들어집니다. 번호를 다시 확인해 주세요.
              </Text>
            </View>
          )}

          {codeSent && isNewBusiness && (
            <View style={styles.signupNotice}>
              <Text style={styles.signupNoticeTitle}>사업자 가입 정보</Text>
              <Text style={styles.signupNoticeText}>국세청 사업자등록번호 인증 후 TrustPay 사업자 계정이 생성됩니다.</Text>
              <TextInput
                style={styles.input}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="상호명"
                placeholderTextColor={colors.gray400}
              />
              <TextInput
                style={styles.input}
                value={businessCategory}
                onChangeText={setBusinessCategory}
                placeholder="업종"
                placeholderTextColor={colors.gray400}
              />
              <TextInput
                style={styles.input}
                value={businessAddress}
                onChangeText={setBusinessAddress}
                placeholder="사업장 주소"
                placeholderTextColor={colors.gray400}
              />
              <TextInput
                style={styles.input}
                value={businessRegistrationNumber}
                onChangeText={(value) => {
                  setBusinessRegistrationNumber(value.replace(/\D/g, '').slice(0, 10));
                  setBusinessNumberVerified(false);
                  setBusinessVerificationLabel('데모 국세청 인증 완료');
                }}
                placeholder="사업자등록번호 10자리"
                placeholderTextColor={colors.gray400}
                keyboardType="number-pad"
                maxLength={10}
              />
              <TouchableOpacity
                style={[styles.verifyBusinessButton, (businessRegistrationDigits.length !== 10 || verifyBusinessRegistrationMutation.isPending) && styles.buttonDisabled]}
                onPress={() => verifyBusinessRegistrationMutation.mutate()}
                disabled={businessRegistrationDigits.length !== 10 || verifyBusinessRegistrationMutation.isPending}
                activeOpacity={0.8}
              >
                <Text style={styles.verifyBusinessButtonText}>국세청 사업자등록번호 인증</Text>
              </TouchableOpacity>
              {isBusinessNumberVerified && <Text style={styles.businessVerifiedText}>{businessVerificationLabel}</Text>}
            </View>
          )}

          <PrimaryActionButton
            label={codeSent ? (isNewConsumer ? '가입하고 시작' : isNewBusiness ? '가입하고 로그인' : '로그인') : '인증코드 받기'}
            loadingLabel={requestCodeMutation.isPending ? '인증코드 요청 중...' : '로그인 중...'}
            onPress={handleSubmit}
            disabled={(codeSent ? (!canVerify || !canSubmitBusinessSignup) : !canSubmit) || isPending}
            loading={isPending}
          />
        </View>

        <Text style={styles.hint}>
          {role === 'consumer'
            ? '첫 로그인 시 원화 우선 표시와 보호 원장 증빙이 자동 준비됩니다'
            : '사업자는 국세청 사업자등록번호 인증 후 가입할 수 있습니다'}
        </Text>
      </ScrollView>
      <AppMessageModal
        visible={!!messageModal}
        title={messageModal?.title ?? ''}
        message={messageModal?.message ?? ''}
        tone={messageModal?.tone ?? 'danger'}
        onClose={() => setMessageModal(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: isWeb ? 'flex-start' : 'center',
    alignItems: isWeb ? 'center' : 'stretch',
    padding: isWeb ? spacing.lg : spacing.xxl,
  },
  brandArea: {
    alignItems: 'center',
    marginBottom: isWeb ? spacing.lg : spacing.xxxl,
  },
  logoCircle: {
    width: isWeb ? 56 : 72,
    height: isWeb ? 56 : 72,
    borderRadius: isWeb ? 28 : 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isWeb ? spacing.sm : spacing.lg,
    ...shadow.md,
  },
  logoText: {
    fontSize: isWeb ? font.size.lg : font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.white,
    letterSpacing: 1,
  },
  title: {
    fontSize: isWeb ? font.size.xxl : font.size.hero,
    fontWeight: font.weight.bold,
    color: colors.gray900,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: font.size.sm,
    color: colors.gray500,
    marginTop: spacing.xs,
  },
  formCard: {
    width: '100%',
    maxWidth: isWeb ? 460 : undefined,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: isWeb ? spacing.lg : spacing.xl,
    ...shadow.sm,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: isWeb ? spacing.lg : spacing.xl,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  segmentActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  segmentIcon: { fontSize: 20, marginBottom: spacing.xs },
  segmentIconActive: {},
  segmentText: {
    fontSize: font.size.md,
    color: colors.gray500,
    fontWeight: font.weight.medium,
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: font.weight.semibold,
  },
  inputGroup: { marginBottom: isWeb ? spacing.md : spacing.lg },
  label: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    marginBottom: spacing.xs,
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
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  signupNotice: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  signupNoticeTitle: {
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  signupNoticeText: {
    fontSize: font.size.sm,
    color: colors.gray700,
    lineHeight: 20,
  },
  verifyBusinessButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  verifyBusinessButtonText: {
    color: colors.primary,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  businessVerifiedText: {
    color: colors.success,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    marginTop: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadow.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: colors.white,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  hint: {
    fontSize: font.size.xs,
    color: colors.gray400,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 16,
  },
});
