import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';
import { colors } from '../theme';

type PaymentRequestQrCodeProps = {
  code: string;
  size?: number;
};

const QUIET_ZONE = 4;

export function PaymentRequestQrCode({ code, size = 132 }: PaymentRequestQrCodeProps) {
  const { modules, viewBoxSize } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(code);
    qr.make();
    const moduleCount = qr.getModuleCount();
    const darkModules = [];
    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        if (qr.isDark(row, col)) darkModules.push({ row: row + QUIET_ZONE, col: col + QUIET_ZONE });
      }
    }
    return { modules: darkModules, viewBoxSize: moduleCount + QUIET_ZONE * 2 };
  }, [code]);

  return (
    <View
      accessibilityLabel={`${code} 실제 결제 QR`}
      accessibilityRole="image"
      testID="payment-request-qr-code"
      style={[styles.frame, { height: size, width: size }]}
    >
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
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.gray200,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
