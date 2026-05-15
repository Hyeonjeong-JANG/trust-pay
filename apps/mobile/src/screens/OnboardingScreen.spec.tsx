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

    expect(getByText('선불금, 한 번에 넘기지 않아요')).toBeTruthy();
    expect(getByText('폐업해도 남은 금액은 지켜요')).toBeTruthy();
    expect(getByText('원화로 먼저 확인해요')).toBeTruthy();
    expect(getByText('QR 결제로 신뢰까지 전달')).toBeTruthy();
  });

  it('should explain customer-facing service benefits instead of implementation details', () => {
    const { getByText, queryByText } = render(
      <OnboardingScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(queryByText('데모 준비 완료')).toBeNull();
    expect(queryByText('XRPL 보호 원장')).toBeNull();
    expect(getByText(/결제 금액은 이용 기간별로 나뉘어 보호되고/)).toBeTruthy();
    expect(getByText(/아직 이용하지 않은 금액은 환불 가능한 보호 잔액으로 남습니다/)).toBeTruthy();
    expect(getByText(/RLUSD 원장 기록은 증빙용으로만 확인합니다/)).toBeTruthy();
    expect(getByText(/보호 결제가 시작되어 안심하고 장기 결제할 수 있습니다/)).toBeTruthy();
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

    expect(getByText(/이용한 달의 금액만 사업자에게 정산됩니다/)).toBeTruthy();
    expect(getByText(/서비스가 중단되면/)).toBeTruthy();
  });

  it('should center onboarding content against the whole screen while preserving footer controls', () => {
    const { getAllByTestId, getByTestId } = render(
      <OnboardingScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByTestId('onboarding-slides').props.style).toEqual(
      expect.objectContaining({ flex: 1 }),
    );
    expect(getByTestId('onboarding-slides').props.contentContainerStyle).toEqual(
      expect.objectContaining({ flexGrow: 1 }),
    );
    expect(getAllByTestId('onboarding-slide')[0].props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ justifyContent: 'center' }),
        expect.objectContaining({ minHeight: expect.any(Number) }),
      ]),
    );
    expect(getAllByTestId('onboarding-content')[0].props.style).toEqual(
      expect.objectContaining({ alignItems: 'center' }),
    );
    expect(getByTestId('onboarding-footer').props.style).toEqual(
      expect.objectContaining({
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: 50,
      }),
    );
  });
});
