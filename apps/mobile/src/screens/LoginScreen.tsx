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

  const loginMutation = useMutation({
    mutationFn: () =>
      api.login({
        ...(method === 'phone' ? { phone } : { email }),
        role,
        ...(name ? { name } : {}),
      }),
    onSuccess: (data) => {
      setAuth(data.role, data.userId, data.name);
    },
    onError: (err: Error) => {
      const apiErr = err as import('../api/client').ApiError;
      const title = apiErr.code === 'NETWORK' ? '네트워크 오류' : '로그인 실패';
      Alert.alert(title, apiErr.userMessage ?? err.message);
    },
  });

  const isPhoneValid = /^01[016789]-?\d{3,4}-?\d{4}$/.test(phone);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = method === 'phone' ? isPhoneValid : isEmailValid;

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
                onPress={() => setRole(r)}
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
                onPress={() => setMethod(m)}
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
                onChangeText={setPhone}
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
                onChangeText={setEmail}
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
                onChangeText={setName}
                placeholder="이름을 입력하세요"
                placeholderTextColor={colors.gray400}
              />
            </View>
          )}

          {/* 로그인 버튼 */}
          <TouchableOpacity
            style={[styles.button, (!canSubmit || loginMutation.isPending) && styles.buttonDisabled]}
            onPress={() => loginMutation.mutate()}
            disabled={!canSubmit || loginMutation.isPending}
            activeOpacity={0.8}
          >
            {loginMutation.isPending ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.buttonText}>
                  {role === 'consumer' ? ' 지갑 생성 중...' : ' 로그인 중...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>로그인</Text>
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
