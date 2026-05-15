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
    illustration: <ShieldIllustration size={120} />,
    title: '선불금을 월별로 보호',
    desc: '이미 이용한 월차만 사업자에게 정산되고\n남은 월차는 취소 시 환불할 수 있습니다.',
  },
  {
    key: '2',
    illustration: <EscrowIllustration size={120} />,
    title: 'XRPL 보호 원장',
    desc: 'XRP Ledger Testnet의 보호 원장에 각 월차를 보관합니다.\n정산 가능 시점 이후 월별 흐름이 원장에 남습니다.',
  },
  {
    key: '3',
    illustration: <StablecoinIllustration size={120} />,
    title: '원화 우선 결제 확인',
    desc: '앱에서는 원화 금액을 먼저 확인하고\nRLUSD는 보호 원장 증빙용 보조 단위로만 표시됩니다.',
  },
  {
    key: '4',
    illustration: <RocketIllustration size={120} />,
    title: 'QR로 간편하게 시작',
    desc: '사업자는 결제 QR만 만들고\n손님은 계좌 승인만 하면 보호 결제가 시작됩니다.',
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
          <View testID="onboarding-slide" style={[s.slide, { width }]}>
            <View testID="onboarding-content" style={s.contentWrap}>
              <View style={s.illustrationWrap}>{item.illustration}</View>
              <Text style={s.slideTitle}>{item.title}</Text>
              <Text style={s.slideDesc}>{item.desc}</Text>
            </View>
          </View>
        )}
      />

      {/* Dots + CTA */}
      <View testID="onboarding-footer" style={s.footer}>
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
  contentWrap: {
    alignItems: 'center',
  },
  illustrationWrap: {
    marginBottom: spacing.xl,
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
