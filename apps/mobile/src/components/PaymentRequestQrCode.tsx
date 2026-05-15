import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';
import { colors, font, radius, shadow, spacing } from '../theme';

type PaymentRequestQrCodeProps = {
  code: string;
  size?: number;
};

const QUIET_ZONE = 4;
const DEFAULT_QR_SIZE = 188;

export function buildPaymentRequestQrPayload(code: string): string {
  const normalizedCode = code.trim().toUpperCase();
  return `trustpay://payment-request?code=${encodeURIComponent(normalizedCode)}`;
}

export function PaymentRequestQrCode({ code, size = DEFAULT_QR_SIZE }: PaymentRequestQrCodeProps) {
  const normalizedCode = code.trim().toUpperCase();
  const { modules, viewBoxSize } = useMemo(() => {
    const qr = qrcode(0, 'Q');
    qr.addData(buildPaymentRequestQrPayload(normalizedCode));
    qr.make();
    const moduleCount = qr.getModuleCount();
    const darkModules = [];
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        if (qr.isDark(row, col)) darkModules.push({ row: row + QUIET_ZONE, col: col + QUIET_ZONE });
      }
    }
    return { modules: darkModules, viewBoxSize: moduleCount + QUIET_ZONE * 2 };
  }, [normalizedCode]);

  return (
    <View
      accessibilityLabel={`${normalizedCode} 실제 결제 QR, 스캔하면 결제 요청을 불러옵니다`}
      accessibilityRole="image"
      testID="payment-request-qr-code"
      style={styles.shell}
    >
      <View style={styles.scanHeader}>
        <Text style={styles.scanLabel}>SCAN</Text>
        <Text style={styles.brandLabel}>TRUSTPAY</Text>
      </View>
      <View style={[styles.frame, { height: size, width: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}>
          <Rect x={0} y={0} width={viewBoxSize} height={viewBoxSize} fill={colors.white} />
          {modules.map((module) => (
            <Rect
              key={`${module.row}-${module.col}`}
              x={module.col}
              y={module.row}
              width={1}
              height={1}
              fill={colors.gray900}
            />
          ))}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadow.md,
  },
  scanHeader: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  scanLabel: {
    color: colors.gray900,
    fontFamily: font.mono,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: 1.8,
  },
  brandLabel: {
    color: colors.primary,
    fontFamily: font.mono,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: 1.2,
  },
  frame: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    justifyContent: 'center',
    padding: spacing.sm,
  },
});
