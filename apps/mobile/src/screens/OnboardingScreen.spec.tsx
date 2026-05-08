import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OnboardingScreen } from './OnboardingScreen';

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  const MockSvg = (props: any) => React.createElement('Svg', props);
  return {
    __esModule: true,
    default: MockSvg,
    Svg: MockSvg,
    Path: (props: any) => React.createElement('Path', props),
    Circle: (props: any) => React.createElement('Circle', props),
    Rect: (props: any) => React.createElement('Rect', props),
    Text: (props: any) => React.createElement('SvgText', props),
    G: (props: any) => React.createElement('G', props),
    Defs: (props: any) => React.createElement('Defs', props),
    LinearGradient: (props: any) => React.createElement('LinearGradient', props),
    Stop: (props: any) => React.createElement('Stop', props),
  };
});

// Mock app store
const mockSetHasSeenOnboarding = jest.fn();
jest.mock('../store/app', () => ({
  useAppStore: (selector: any) =>
    selector({
      hasSeenOnboarding: false,
      setHasSeenOnboarding: mockSetHasSeenOnboarding,
    }),
}));

const mockNavigation = {
  replace: jest.fn(),
  navigate: jest.fn(),
} as any;

const mockRoute = {} as any;

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render 4 slide titles', () => {
    const { getByText } = render(
      <OnboardingScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('선불금을 월별로 보호')).toBeTruthy();
    expect(getByText('XLS-85 Token Escrow')).toBeTruthy();
    expect(getByText('RLUSD 스테이블코인')).toBeTruthy();
    expect(getByText('데모 준비 완료')).toBeTruthy();
  });

  it('should show skip button', () => {
    const { getByText } = render(
      <OnboardingScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('건너뛰기')).toBeTruthy();
  });

  it('should show next button on first slide', () => {
    const { getByText } = render(
      <OnboardingScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('다음')).toBeTruthy();
  });

  it('should call setHasSeenOnboarding and navigate on skip', () => {
    const { getByText } = render(
      <OnboardingScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.press(getByText('건너뛰기'));

    expect(mockSetHasSeenOnboarding).toHaveBeenCalledWith(true);
    expect(mockNavigation.replace).toHaveBeenCalledWith('Login');
  });

  it('should render slide descriptions', () => {
    const { getByText } = render(
      <OnboardingScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(
      getByText(/이미 이용한 월차만 사업자에게 릴리즈되고/),
    ).toBeTruthy();
    expect(
      getByText(/finishAfter 이후 월별로 릴리즈/),
    ).toBeTruthy();
  });
});
