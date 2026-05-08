import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

export function ShieldIllustration({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Defs>
        <LinearGradient id="shieldBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4A8AF4" />
          <Stop offset="1" stopColor="#1A4FBF" />
        </LinearGradient>
      </Defs>
      {/* Outer glow circle */}
      <Circle cx="70" cy="70" r="68" fill="#EBF1FF" />
      <Circle cx="70" cy="70" r="56" fill="#D6E4FF" opacity={0.5} />
      {/* Shield */}
      <Path
        d="M70 22 L104 38 C104 38 106 76 90 94 C82 104 70 110 70 110 C70 110 58 104 50 94 C34 76 36 38 36 38 Z"
        fill="url(#shieldBg)"
      />
      {/* Checkmark */}
      <Path
        d="M54 68 L65 79 L86 58"
        fill="none"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Decorative dots */}
      <Circle cx="24" cy="40" r="3" fill="#2E6FF3" opacity={0.3} />
      <Circle cx="116" cy="45" r="4" fill="#2E6FF3" opacity={0.2} />
      <Circle cx="20" cy="95" r="2.5" fill="#2E6FF3" opacity={0.25} />
      <Circle cx="120" cy="100" r="3" fill="#2E6FF3" opacity={0.15} />
    </Svg>
  );
}
