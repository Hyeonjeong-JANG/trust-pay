import React from 'react';
import Svg, { Path, Rect, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

export function EscrowIllustration({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Defs>
        <LinearGradient id="lockGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4A8AF4" />
          <Stop offset="1" stopColor="#1A4FBF" />
        </LinearGradient>
      </Defs>
      {/* Background circle */}
      <Circle cx="70" cy="70" r="68" fill="#EBF1FF" />
      {/* Lock body */}
      <Rect x="46" y="62" width="48" height="38" rx="6" fill="url(#lockGrad)" />
      {/* Lock shackle */}
      <Path
        d="M54 62 V50 C54 38 66 28 78 28 V28 C90 28 86 38 86 50 V62"
        fill="none"
        stroke="#2E6FF3"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Keyhole */}
      <Circle cx="70" cy="76" r="5" fill="white" />
      <Rect x="68" y="78" width="4" height="10" rx="2" fill="white" />
      {/* Chain links (representing escrow entries) */}
      <Circle cx="26" cy="70" r="8" fill="none" stroke="#2E6FF3" strokeWidth="2" opacity={0.3} />
      <Circle cx="114" cy="70" r="8" fill="none" stroke="#2E6FF3" strokeWidth="2" opacity={0.3} />
      {/* Connection lines */}
      <Path d="M34 70 H46" stroke="#2E6FF3" strokeWidth="1.5" opacity={0.2} />
      <Path d="M94 70 H106" stroke="#2E6FF3" strokeWidth="1.5" opacity={0.2} />
      {/* Decorative */}
      <Circle cx="30" cy="110" r="3" fill="#2E6FF3" opacity={0.15} />
      <Circle cx="110" cy="30" r="3.5" fill="#2E6FF3" opacity={0.2} />
    </Svg>
  );
}
