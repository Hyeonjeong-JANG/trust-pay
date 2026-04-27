import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { useAppStore } from '../store/app';
import { colors, spacing, radius, font } from '../theme';
import type { ScreenProps } from '../navigation/types';

interface Slide {
  key: string;
  emoji: string;
  title: string;
  desc: string;
}

const SLIDES: Slide[] = [
  {
    key: '1',
    emoji: '\uD83D\uDEE1\uFE0F',
    title: '선불금을 안전하게 보호',
    desc: '학원, 헬스장 등 선불 결제를 블록체인 에스크로로 보호합니다.\n사업자 폐업 시에도 환불이 보장됩니다.',
  },
  {
    key: '2',
    emoji: '\uD83D\uDD10',
    title: 'XRPL Token Escrow',
    desc: 'XRP Ledger의 최신 기능 XLS-85 Token Escrow를 활용합니다.\n매월 자동 릴리즈로 소비자와 사업자 모두 보호됩니다.',
  },
  {
    key: '3',
    emoji: '\uD83D\uDCB5',
    title: 'RLUSD 스테이블코인',
    desc: '달러에 연동된 RLUSD로 가격 변동 걱정 없이\n안정적으로 결제할 수 있습니다.',
  },
  {
    key: '4',
    emoji: '\uD83D\uDE80',
    title: '지금 시작하세요',
    desc: '간편한 로그인으로 바로 시작할 수 있습니다.\n별도의 지갑 설정이 필요 없습니다.',
  },
];

export function OnboardingScreen({ navigation }: ScreenProps<'Onboarding'>) {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const setHasSeenOnboarding = useAppStore((s) => s.setHasSeenOnboarding);

  const onComplete = useCallback(() => {
    setHasSeenOnboarding(true);
    navigation.replace('Login');
  }, [setHasSeenOnboarding, navigation]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={s.container}>
      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity style={s.skipBtn} onPress={onComplete} activeOpacity={0.7}>
          <Text style={s.skipText}>건너뛰기</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={[s.slide, { width }]}>
            <Text style={s.slideEmoji}>{item.emoji}</Text>
            <Text style={s.slideTitle}>{item.title}</Text>
            <Text style={s.slideDesc}>{item.desc}</Text>
          </View>
        )}
      />

      {/* Dots + CTA */}
      <View style={s.footer}>
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === activeIndex && s.dotActive]} />
          ))}
        </View>

        {isLast ? (
          <TouchableOpacity style={s.ctaBtn} onPress={onComplete} activeOpacity={0.85}>
            <Text style={s.ctaText}>시작하기</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={s.nextBtn}
            onPress={() => flatListRef.current?.scrollToIndex({ index: activeIndex + 1 })}
            activeOpacity={0.7}
          >
            <Text style={s.nextText}>다음</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: spacing.xl,
    zIndex: 10,
    padding: spacing.sm,
  },
  skipText: {
    fontSize: font.size.md,
    color: colors.gray400,
    fontWeight: font.weight.medium,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  slideEmoji: {
    fontSize: 72,
    marginBottom: spacing.xxl,
  },
  slideTitle: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  slideDesc: {
    fontSize: font.size.md,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 50,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    marginBottom: spacing.xxl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray200,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  ctaBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxl,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
  },
  ctaText: {
    color: colors.white,
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
  },
  nextBtn: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxl,
  },
  nextText: {
    color: colors.primary,
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
  },
});
