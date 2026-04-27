import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ApiError } from '../api/client';
import { colors, spacing, radius, font } from '../theme';

interface ErrorViewProps {
  error: Error;
  onRetry?: () => void;
}

export function ErrorView({ error, onRetry }: ErrorViewProps) {
  const apiError = error as ApiError;
  const message = apiError.userMessage ?? error.message ?? '오류가 발생했습니다.';
  const canRetry = apiError.isRetryable ?? true;

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>!</Text>
      </View>
      <Text style={styles.title}>문제가 발생했습니다</Text>
      <Text style={styles.message}>{message}</Text>
      {canRetry && onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Format error for Alert.alert — returns Korean user-friendly message */
export function getErrorMessage(error: Error): string {
  const apiError = error as ApiError;
  return apiError.userMessage ?? error.message ?? '오류가 발생했습니다.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 32,
    fontWeight: font.weight.bold,
    color: colors.danger,
  },
  title: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray800,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: font.size.md,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  retryText: {
    color: colors.white,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
});
