import React from 'react';
import Svg, { Path, Circle, Rect, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

export function StablecoinIllustration({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Defs>
        <LinearGradient id="coinGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4A8AF4" />
          <Stop offset="1" stopColor="#1A4FBF" />
        </LinearGradient>
      </Defs>
      {/* Background */}
      <Circle cx="70" cy="70" r="68" fill="#EBF1FF" />
      {/* Coin shadow */}
      <Circle cx="72" cy="74" r="34" fill="#1A4FBF" opacity={0.1} />
      {/* Main coin */}
      <Circle cx="70" cy="70" r="34" fill="url(#coinGrad)" />
      <Circle cx="70" cy="70" r="28" fill="none" stroke="white" strokeWidth="1.5" opacity={0.4} />
      {/* Dollar sign */}
      <SvgText
        x="70"
        y="78"
        textAnchor="middle"
        fontSize="28"
        fontWeight="700"
        fill="white"
      >
        $
      </SvgText>
      {/* Stability indicator lines */}
      <Path d="M22 90 L35 85 L48 88" fill="none" stroke="#00C48C" strokeWidth="2" strokeLinecap="round" />
      <Path d="M92 88 L105 85 L118 90" fill="none" stroke="#00C48C" strokeWidth="2" strokeLinecap="round" />
      {/* Equal sign (stability) */}
      <Rect x="30" y="42" width="16" height="3" rx="1.5" fill="#2E6FF3" opacity={0.25} />
      <Rect x="30" y="48" width="16" height="3" rx="1.5" fill="#2E6FF3" opacity={0.25} />
      <Rect x="94" y="42" width="16" height="3" rx="1.5" fill="#2E6FF3" opacity={0.25} />
      <Rect x="94" y="48" width="16" height="3" rx="1.5" fill="#2E6FF3" opacity={0.25} />
      {/* Decorative */}
      <Circle cx="25" cy="115" r="2.5" fill="#2E6FF3" opacity={0.2} />
      <Circle cx="115" cy="25" r="3" fill="#2E6FF3" opacity={0.15} />
    </Svg>
  );
}
