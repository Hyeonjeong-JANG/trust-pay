import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, font, radius, shadow, spacing } from '../theme';

const DEMO_APPROVAL_PIN = '123456';

type ApprovalAuthModalProps = {
  visible: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onAuthenticated: () => void;
};

export function ApprovalAuthModal({
  visible,
  title,
  description,
  onCancel,
  onAuthenticated,
}: ApprovalAuthModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const titleRef = useRef(title);
  const onAuthenticatedRef = useRef(onAuthenticated);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
  }, [onAuthenticated]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    setPin('');
    setError(null);
    setCanUseBiometric(false);

    async function authenticateWithBiometric() {
      if (Platform.OS === 'web') return;

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (cancelled || !hasHardware || !isEnrolled) return;

      setCanUseBiometric(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: titleRef.current,
        cancelLabel: '취소',
        fallbackLabel: '간편비밀번호 사용',
      });

      if (!cancelled && result.success) {
        onAuthenticatedRef.current();
      }
    }

    authenticateWithBiometric().catch(() => {
      if (!cancelled) setCanUseBiometric(false);
    });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const authenticateWithPin = () => {
    if (pin === DEMO_APPROVAL_PIN) {
      setError(null);
      onAuthenticated();
      return;
    }

    setError('간편비밀번호가 올바르지 않습니다.');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>✓</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          {canUseBiometric && <Text style={styles.biometricHint}>지문 또는 Face ID 인증을 먼저 시도합니다.</Text>}
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={(value) => {
              setPin(value.replace(/\D/g, '').slice(0, 6));
              if (error) setError(null);
            }}
            keyboardType="number-pad"
            placeholder="간편비밀번호 6자리"
            placeholderTextColor={colors.gray400}
            secureTextEntry
            maxLength={6}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.primaryButton} onPress={authenticateWithPin} activeOpacity={0.84}>
            <Text style={styles.primaryText}>간편비밀번호로 승인</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.cancelText}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.46)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.lg,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  iconText: {
    color: colors.primary,
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
  },
  title: {
    color: colors.gray900,
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    textAlign: 'center',
  },
  description: {
    color: colors.gray600,
    fontSize: font.size.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  biometricHint: {
    color: colors.primary,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
    color: colors.gray900,
    fontSize: font.size.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  primaryText: {
    color: colors.white,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  cancelButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  cancelText: {
    color: colors.gray500,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
});
