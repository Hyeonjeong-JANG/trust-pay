import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { colors, spacing, radius, font, shadow } from '../theme';

type UserRole = 'consumer' | 'business';
type LoginMethod = 'phone' | 'email';

export function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [role, setRole] = useState<UserRole>('consumer');
  const [method, setMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  const authPayload = () => ({
    ...(method === 'phone' ? { phone } : { email }),
    role,
    ...(name ? { name } : {}),
  });

  const resetCode = () => {
    setCode('');
    setCodeSent(false);
    setDemoCode(null);
  };

  const requestCodeMutation = useMutation({
    mutationFn: () => api.requestCode(authPayload()),
    onSuccess: (data) => {
      setCodeSent(true);
      setDemoCode(data.code ?? null);
      if (data.code) setCode(data.code);
    },
    onError: (err: Error) => {
      const apiErr = err as import('../api/client').ApiError;
      const title = apiErr.code === 'NETWORK' ? '네트워크 오류' : '인증코드 요청 실패';
      Alert.alert(title, apiErr.userMessage ?? err.message);
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: () => api.verifyCode({ ...authPayload(), code }),
    onSuccess: (data) => {
      setAuth(data.role, data.userId, data.name, data.token);
    },
    onError: (err: Error) => {
      const apiErr = err as import('../api/client').ApiError;
      const title = apiErr.code === 'NETWORK' ? '네트워크 오류' : '로그인 실패';
      Alert.alert(title, apiErr.userMessage ?? err.message);
    },
  });

  const isMobilePhoneValid = /^01[016789]-?\d{3,4}-?\d{4}$/.test(phone);
  const isLandlinePhoneValid = /^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(phone);
  const isPhoneValid = role === 'business'
    ? isMobilePhoneValid || isLandlinePhoneValid
    : isMobilePhoneValid;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = method === 'phone' ? isPhoneValid : isEmailValid;
  const canVerify = canSubmit && /^\d{6}$/.test(code);
  const isPending = requestCodeMutation.isPending || verifyCodeMutation.isPending;

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
            <Text style={styles.logoText}>PS</Text>
          </View>
          <Text style={styles.title}>PrepaidShield</Text>
          <Text style={styles.subtitle}>XRPL 기반 RLUSD 선불 보호 서비스</Text>
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

          {/* 로그인 방식 선택 */}
          <View style={styles.methodRow}>
            {(['phone', 'email'] as LoginMethod[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.methodButton, method === m && styles.methodActive]}
                onPress={() => {
                  setMethod(m);
                  resetCode();
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.methodText, method === m && styles.methodTextActive]}>
                  {m === 'phone' ? '전화번호' : '이메일'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 입력 필드 */}
          {method === 'phone' ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>전화번호</Text>
              <TextInput
                style={[styles.input, phone && !isPhoneValid && styles.inputError]}
                value={phone}
                onChangeText={(value) => {
                  setPhone(value);
                  resetCode();
                }}
                placeholder="010-1234-5678"
                placeholderTextColor={colors.gray400}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>이메일</Text>
              <TextInput
                style={[styles.input, email && !isEmailValid && styles.inputError]}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  resetCode();
                }}
                placeholder="user@example.com"
                placeholderTextColor={colors.gray400}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          )}

          {role === 'consumer' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>이름 (선택)</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  resetCode();
                }}
                placeholder="이름을 입력하세요"
                placeholderTextColor={colors.gray400}
              />
            </View>
          )}

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
              {demoCode && (
                <Text style={styles.demoCode}>데모 인증코드: {demoCode}</Text>
              )}
            </View>
          )}

          {/* 로그인 버튼 */}
          <TouchableOpacity
            style={[styles.button, ((codeSent ? !canVerify : !canSubmit) || isPending) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={(codeSent ? !canVerify : !canSubmit) || isPending}
            activeOpacity={0.8}
          >
            {isPending ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.buttonText}>
                  {requestCodeMutation.isPending ? ' 인증코드 요청 중...' : ' 로그인 중...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>{codeSent ? '로그인' : '인증코드 받기'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          {role === 'consumer'
            ? '첫 로그인 시 XRPL 지갑 + RLUSD 트러스트라인이 자동 생성됩니다'
            : '사업자 계정은 관리자가 사전 등록해야 합니다'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  brandArea: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  logoText: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.white,
    letterSpacing: 1,
  },
  title: {
    fontSize: font.size.hero,
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
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.sm,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
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
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  methodButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
  },
  methodActive: { backgroundColor: colors.primary },
  methodText: {
    fontSize: font.size.sm,
    color: colors.gray500,
    fontWeight: font.weight.medium,
  },
  methodTextActive: {
    color: colors.white,
    fontWeight: font.weight.semibold,
  },
  inputGroup: { marginBottom: spacing.lg },
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
  demoCode: {
    color: colors.primary,
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
