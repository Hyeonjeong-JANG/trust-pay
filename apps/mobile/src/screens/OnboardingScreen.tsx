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
import { ShieldIllustration } from '../components/illustrations/ShieldIllustration';
import { EscrowIllustration } from '../components/illustrations/EscrowIllustration';
import { StablecoinIllustration } from '../components/illustrations/StablecoinIllustration';
import { RocketIllustration } from '../components/illustrations/RocketIllustration';
import { colors, spacing, radius, font } from '../theme';
import type { ScreenProps } from '../navigation/types';

interface Slide {
  key: string;
  illustration: React.ReactNode;
  title: string;
  desc: string;
}

const SLIDES: Slide[] = [
  {
    key: '1',
    illustration: <ShieldIllustration size={140} />,
    title: '선불금을 월별로 보호',
    desc: '이미 이용한 월차만 사업자에게 릴리즈되고\n남은 월차는 취소 시 환불할 수 있습니다.',
  },
  {
    key: '2',
    illustration: <EscrowIllustration size={140} />,
    title: 'XLS-85 Token Escrow',
    desc: 'XRP Ledger Testnet의 Token Escrow로 각 월차를 잠급니다.\nfinishAfter 이후 월별로 릴리즈되어 흐름이 원장에 남습니다.',
  },
  {
    key: '3',
    illustration: <StablecoinIllustration size={140} />,
    title: 'RLUSD 스테이블코인',
    desc: '달러에 연동된 RLUSD로 가격 변동 걱정 없이\n안정적으로 결제할 수 있습니다.',
  },
  {
    key: '4',
    illustration: <RocketIllustration size={140} />,
    title: '데모 준비 완료',
    desc: '소비자와 사업자 로그인만으로 Demo Mode를 확인합니다.\nTestnet Mode에서는 tx hash로 원장 증거를 검증합니다.',
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
            <View style={s.illustrationWrap}>{item.illustration}</View>
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
  illustrationWrap: {
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
