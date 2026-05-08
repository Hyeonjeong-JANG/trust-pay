import React from 'react';
import Svg, { Path, Circle, Text as SvgText, G, Defs, LinearGradient, Stop } from 'react-native-svg';

interface LogoProps {
  size?: number;
}

export function Logo({ size = 120 }: LogoProps) {
  const scale = size / 120;

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4A8AF4" />
          <Stop offset="1" stopColor="#1A4FBF" />
        </LinearGradient>
        <LinearGradient id="checkGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#E0EAFF" />
        </LinearGradient>
      </Defs>

      {/* Background circle */}
      <Circle cx="60" cy="60" r="58" fill="#EBF1FF" />

      {/* Shield body */}
      <Path
        d="M60 16 L92 30 C92 30 94 65 80 82 C72 92 60 98 60 98 C60 98 48 92 40 82 C26 65 28 30 28 30 Z"
        fill="url(#shieldGrad)"
        stroke="#1A4FBF"
        strokeWidth="1.5"
      />

      {/* Checkmark */}
      <Path
        d="M44 58 L55 69 L76 48"
        fill="none"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* PS text */}
      <SvgText
        x="60"
        y="108"
        textAnchor="middle"
        fontSize={14 * scale > 14 ? 14 : 14}
        fontWeight="700"
        fill="#1A4FBF"
        letterSpacing={2}
      >
        PS
      </SvgText>
    </Svg>
  );
}
