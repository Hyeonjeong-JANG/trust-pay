import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, font, radius, shadow, spacing } from '../theme';

export type AppMessageTone = 'info' | 'success' | 'danger';

type AppMessageModalProps = {
  visible: boolean;
  title: string;
  message: string;
  tone?: AppMessageTone;
  closeLabel?: string;
  onClose: () => void;
};

const TONE_COLORS: Record<AppMessageTone, { bg: string; text: string }> = {
  info: { bg: colors.primaryLight, text: colors.primary },
  success: { bg: colors.successLight, text: colors.success },
  danger: { bg: colors.dangerLight, text: colors.danger },
};

export function AppMessageModal({
  visible,
  title,
  message,
  tone = 'info',
  closeLabel = '확인',
  onClose,
}: AppMessageModalProps) {
  const toneColor = TONE_COLORS[tone];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.badge, { backgroundColor: toneColor.bg }]}>
            <Text style={[styles.badgeText, { color: toneColor.text }]}>TP</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.82}>
            <Text style={styles.buttonText}>{closeLabel}</Text>
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
  badge: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 44,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 44,
  },
  badgeText: {
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
  title: {
    color: colors.gray900,
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.gray600,
    fontSize: font.size.md,
    lineHeight: 22,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  buttonText: {
    color: colors.white,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
});
