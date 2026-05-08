import React from 'react';
import { render } from '@testing-library/react-native';
import { Animated } from 'react-native';
import {
  SkeletonBox,
  BalanceCardSkeleton,
  EscrowCardSkeleton,
  TimelineEntrySkeleton,
  HistoryCardSkeleton,
  SummaryCardSkeleton,
  BusinessSummaryRowSkeleton,
} from './Skeleton';

// Spy on Animated.loop to verify animation starts
const loopSpy = jest.spyOn(Animated, 'loop');

describe('Skeleton Components', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should render SkeletonBox with given width and height', () => {
    const { toJSON } = render(<SkeletonBox width={100} height={20} />);
    expect(toJSON()).toBeTruthy();
  });

  it('should render SkeletonBox with string width', () => {
    const { toJSON } = render(<SkeletonBox width="100%" height={16} />);
    expect(toJSON()).toBeTruthy();
  });

  it('should render SkeletonBox with custom borderRadius', () => {
    const { toJSON } = render(<SkeletonBox width={50} height={50} borderRadius={25} />);
    expect(toJSON()).toBeTruthy();
  });

  it('should start pulse animation on mount', () => {
    render(<SkeletonBox width={80} height={12} />);
    expect(loopSpy).toHaveBeenCalled();
  });

  it('should render BalanceCardSkeleton', () => {
    const { toJSON } = render(<BalanceCardSkeleton />);
    expect(toJSON()).toBeTruthy();
  });

  it('should render EscrowCardSkeleton', () => {
    const { toJSON } = render(<EscrowCardSkeleton />);
    expect(toJSON()).toBeTruthy();
  });

  it('should render TimelineEntrySkeleton', () => {
    const { toJSON } = render(<TimelineEntrySkeleton />);
    expect(toJSON()).toBeTruthy();
  });

  it('should render HistoryCardSkeleton', () => {
    const { toJSON } = render(<HistoryCardSkeleton />);
    expect(toJSON()).toBeTruthy();
  });

  it('should render SummaryCardSkeleton', () => {
    const { toJSON } = render(<SummaryCardSkeleton />);
    expect(toJSON()).toBeTruthy();
  });

  it('should render BusinessSummaryRowSkeleton', () => {
    const { toJSON } = render(<BusinessSummaryRowSkeleton />);
    expect(toJSON()).toBeTruthy();
  });
});
