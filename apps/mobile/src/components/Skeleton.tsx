import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';

function usePulseAnimation() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  return opacity;
}

export function SkeletonBox({
  width,
  height,
  borderRadius = 4,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}) {
  const opacity = usePulseAnimation();
  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: colors.gray200, opacity },
        style,
      ]}
    />
  );
}

export function BalanceCardSkeleton() {
  const opacity = usePulseAnimation();
  return (
    <Animated.View style={[s.balanceCard, { opacity }]}>
      <View style={[s.skRect, { width: 80, height: 12, backgroundColor: 'rgba(255,255,255,0.3)' }]} />
      <View style={[s.skRect, { width: 160, height: 28, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 8 }]} />
      <View style={[s.skRect, { width: 120, height: 10, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 8 }]} />
    </Animated.View>
  );
}

export function EscrowCardSkeleton() {
  const opacity = usePulseAnimation();
  return (
    <Animated.View style={[s.card, { opacity }]}>
      <View style={s.row}>
        <View style={[s.skRect, { width: 100, height: 14 }]} />
        <View style={[s.skRect, { width: 50, height: 20, borderRadius: radius.full }]} />
      </View>
      <View style={[s.skRect, { width: 130, height: 14, marginTop: 10 }]} />
      <View style={[s.skRect, { width: '100%', height: 4, borderRadius: 2, marginTop: 12 }]} />
      <View style={[s.skRect, { width: 90, height: 12, marginTop: 6 }]} />
    </Animated.View>
  );
}

export function TimelineEntrySkeleton() {
  const opacity = usePulseAnimation();
  return (
    <View style={s.timelineRow}>
      <View style={s.timelineLeft}>
        <Animated.View style={[s.timelineDot, { opacity }]} />
        <View style={s.timelineLine} />
      </View>
      <Animated.View style={[s.scheduleCard, { opacity }]}>
        <View style={s.row}>
          <View style={[s.skRect, { width: 100, height: 12 }]} />
          <View style={[s.skRect, { width: 50, height: 12 }]} />
        </View>
        <View style={[s.skRect, { width: 80, height: 14, marginTop: 8 }]} />
        <View style={[s.row, { marginTop: 8 }]}>
          <View style={[s.skRect, { width: 40, height: 12 }]} />
          <View style={[s.skRect, { width: 80, height: 14 }]} />
        </View>
      </Animated.View>
    </View>
  );
}

export function HistoryCardSkeleton() {
  const opacity = usePulseAnimation();
  return (
    <Animated.View style={[s.historyCard, { opacity }]}>
      <View style={[s.iconCircle, { backgroundColor: colors.gray100 }]} />
      <View style={{ flex: 1 }}>
        <View style={[s.skRect, { width: 90, height: 13 }]} />
        <View style={[s.skRect, { width: 120, height: 11, marginTop: 4 }]} />
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <View style={[s.skRect, { width: 70, height: 14 }]} />
        <View style={[s.skRect, { width: 40, height: 10, marginTop: 3 }]} />
      </View>
    </Animated.View>
  );
}

export function SummaryCardSkeleton() {
  const opacity = usePulseAnimation();
  return (
    <Animated.View style={[s.balanceCard, { opacity }]}>
      <View style={[s.skRect, { width: 80, height: 12, backgroundColor: 'rgba(255,255,255,0.3)' }]} />
      <View style={[s.row, { marginTop: 12, justifyContent: 'center' }]}>
        <View style={[s.skRect, { width: 60, height: 26, backgroundColor: 'rgba(255,255,255,0.2)' }]} />
        <View style={{ width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 20 }} />
        <View style={[s.skRect, { width: 80, height: 26, backgroundColor: 'rgba(255,255,255,0.2)' }]} />
      </View>
    </Animated.View>
  );
}

export function BusinessSummaryRowSkeleton() {
  const opacity = usePulseAnimation();
  return (
    <View style={s.summaryRow}>
      <Animated.View style={[s.summaryCard, { opacity }]}>
        <View style={[s.skRect, { width: 24, height: 24, borderRadius: 12 }]} />
        <View style={[s.skRect, { width: 60, height: 20, marginTop: 6 }]} />
        <View style={[s.skRect, { width: 80, height: 11, marginTop: 6 }]} />
      </Animated.View>
      <Animated.View style={[s.summaryCard, { opacity }]}>
        <View style={[s.skRect, { width: 24, height: 24, borderRadius: 12 }]} />
        <View style={[s.skRect, { width: 60, height: 20, marginTop: 6 }]} />
        <View style={[s.skRect, { width: 80, height: 11, marginTop: 6 }]} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  balanceCard: {
    backgroundColor: colors.primary,
    padding: spacing.xl,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...shadow.md,
  },
  card: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skRect: {
    backgroundColor: colors.gray200,
    borderRadius: 4,
  },
  timelineRow: { flexDirection: 'row', minHeight: 80 },
  timelineLeft: { width: 32, alignItems: 'center' },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gray300,
    marginTop: 16,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.gray200,
    marginTop: 4,
  },
  scheduleCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
    ...shadow.sm,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.md,
  },
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadow.sm,
  },
});
