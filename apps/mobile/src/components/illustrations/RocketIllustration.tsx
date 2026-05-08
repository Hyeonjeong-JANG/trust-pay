import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

export function RocketIllustration({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Defs>
        <LinearGradient id="rocketGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4A8AF4" />
          <Stop offset="1" stopColor="#1A4FBF" />
        </LinearGradient>
        <LinearGradient id="flameGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF9F0A" />
          <Stop offset="1" stopColor="#FF3B30" />
        </LinearGradient>
      </Defs>
      {/* Background */}
      <Circle cx="70" cy="70" r="68" fill="#EBF1FF" />
      {/* Rocket body */}
      <Path
        d="M70 24 C70 24 56 44 56 72 C56 88 62 98 70 98 C78 98 84 88 84 72 C84 44 70 24 70 24Z"
        fill="url(#rocketGrad)"
      />
      {/* Nose cone highlight */}
      <Path
        d="M70 24 C70 24 64 40 63 56"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={0.3}
      />
      {/* Window */}
      <Circle cx="70" cy="60" r="7" fill="white" />
      <Circle cx="70" cy="60" r="5" fill="#EBF1FF" />
      {/* Left fin */}
      <Path d="M56 78 L42 92 L56 90Z" fill="#1A4FBF" />
      {/* Right fin */}
      <Path d="M84 78 L98 92 L84 90Z" fill="#1A4FBF" />
      {/* Flame */}
      <Path
        d="M63 98 C63 98 66 112 70 118 C74 112 77 98 77 98"
        fill="url(#flameGrad)"
      />
      <Path
        d="M66 98 C66 98 68 108 70 112 C72 108 74 98 74 98"
        fill="#FF9F0A"
        opacity={0.7}
      />
      {/* Stars */}
      <Circle cx="28" cy="35" r="2" fill="#2E6FF3" opacity={0.3} />
      <Circle cx="110" cy="42" r="2.5" fill="#2E6FF3" opacity={0.25} />
      <Circle cx="22" cy="90" r="1.5" fill="#2E6FF3" opacity={0.2} />
      <Circle cx="118" cy="85" r="2" fill="#2E6FF3" opacity={0.2} />
      <Circle cx="38" cy="55" r="1.5" fill="#2E6FF3" opacity={0.15} />
      <Circle cx="102" cy="60" r="1.5" fill="#2E6FF3" opacity={0.15} />
    </Svg>
  );
}
