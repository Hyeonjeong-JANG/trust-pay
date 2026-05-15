import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, shadow, spacing } from '../theme';

const XRPL_TESTNET_TRANSACTION_URL = 'https://testnet.xrpl.org/transactions';

export function buildXrplTransactionUrl(txHash: string) {
  return `${XRPL_TESTNET_TRANSACTION_URL}/${encodeURIComponent(txHash)}`;
}

function shortenTxHash(txHash: string) {
  if (txHash.length <= 20) return txHash;
  return `${txHash.slice(0, 8)}...${txHash.slice(-8)}`;
}

type XrplTransactionProofProps = {
  txHash: string;
  label?: string;
};

export function XrplTransactionProof({ txHash, label = '원장 증빙' }: XrplTransactionProofProps) {
  const openExplorer = () => {
    void Linking.openURL(buildXrplTransactionUrl(txHash));
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>XRPL</Text>
        </View>
        <View style={styles.titleGroup}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.network}>XRPL Testnet 증빙</Text>
        </View>
      </View>
      <Text style={styles.hash}>{shortenTxHash(txHash)}</Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="XRPL Explorer에서 원장 증빙 확인"
        onPress={openExplorer}
        style={({ pressed }) => [styles.linkButton, pressed && styles.linkButtonPressed]}
      >
        <Text style={styles.linkText}>XRPL Explorer에서 확인</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    ...shadow.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  badgeText: {
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  titleGroup: {
    flex: 1,
  },
  label: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.gray900,
  },
  network: {
    marginTop: 2,
    fontSize: font.size.xs,
    color: colors.gray500,
  },
  hash: {
    marginTop: spacing.sm,
    fontSize: font.size.sm,
    fontFamily: font.mono,
    color: colors.gray800,
  },
  linkButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.gray50,
  },
  linkButtonPressed: {
    opacity: 0.72,
  },
  linkText: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: colors.primary,
  },
});
