import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ApiError } from '../api/client';

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
      <Text style={styles.icon}>!</Text>
      <Text style={styles.message}>{message}</Text>
      {canRetry && onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
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
    padding: 24,
  },
  icon: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF3B30',
    width: 72,
    height: 72,
    lineHeight: 72,
    textAlign: 'center',
    borderRadius: 36,
    backgroundColor: '#FFF0F0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
