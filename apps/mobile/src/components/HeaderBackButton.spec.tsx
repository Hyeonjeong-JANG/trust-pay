import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HeaderBackButton } from './HeaderBackButton';

const mockNavigation = {
  canGoBack: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
};

const mockAuthState = { role: 'consumer' as 'consumer' | 'business' | null };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('../store/auth', () => ({
  useAuthStore: (selector: any) => selector(mockAuthState),
}));

describe('HeaderBackButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.role = 'consumer';
  });

  it('should go back when stack history exists', () => {
    mockNavigation.canGoBack.mockReturnValue(true);
    const { getByText } = render(<HeaderBackButton />);

    fireEvent.press(getByText('뒤로'));

    expect(mockNavigation.goBack).toHaveBeenCalled();
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('should fall back to the consumer home tab when there is no stack history', () => {
    mockNavigation.canGoBack.mockReturnValue(false);
    const { getByText } = render(<HeaderBackButton />);

    fireEvent.press(getByText('뒤로'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('ConsumerTabs', { screen: 'Home' });
  });

  it('should fall back to the merchant dashboard when there is no stack history', () => {
    mockAuthState.role = 'business';
    mockNavigation.canGoBack.mockReturnValue(false);
    const { getByText } = render(<HeaderBackButton />);

    fireEvent.press(getByText('뒤로'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('BusinessTabs', { screen: 'Dashboard' });
  });
});
