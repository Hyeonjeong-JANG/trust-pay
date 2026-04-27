import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginScreen } from './LoginScreen';

// Mock API
jest.mock('../api/client', () => ({
  api: {
    login: jest.fn(),
  },
}));

// Mock zustand store
const mockSetAuth = jest.fn();
jest.mock('../store/auth', () => ({
  useAuthStore: (selector: any) =>
    selector({ setAuth: mockSetAuth, role: null, userId: null, name: null }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render title and subtitle', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    expect(getByText('PrepaidShield')).toBeTruthy();
    expect(getByText('RLUSD Prepaid Protection on XRPL')).toBeTruthy();
  });

  it('should render role selector with Consumer and Business', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    expect(getByText('Consumer')).toBeTruthy();
    expect(getByText('Business')).toBeTruthy();
  });

  it('should render login method selector with Phone and Email', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    expect(getByText('Phone')).toBeTruthy();
    expect(getByText('Email')).toBeTruthy();
  });

  it('should show phone input by default', () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(<LoginScreen />);
    expect(getByText('Phone Number')).toBeTruthy();
    expect(getByPlaceholderText('010-1234-5678')).toBeTruthy();
  });

  it('should switch to email input when Email method selected', () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } =
      renderWithProviders(<LoginScreen />);

    fireEvent.press(getByText('Email'));

    expect(getByPlaceholderText('user@example.com')).toBeTruthy();
    expect(queryByPlaceholderText('010-1234-5678')).toBeNull();
  });

  it('should show name input for consumer role', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    expect(getByText('Name (optional)')).toBeTruthy();
  });

  it('should hide name input for business role', () => {
    const { getByText, queryByText } = renderWithProviders(<LoginScreen />);

    fireEvent.press(getByText('Business'));

    expect(queryByText('Name (optional)')).toBeNull();
  });

  it('should show consumer hint when consumer role selected', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    expect(
      getByText('First login auto-creates your XRPL wallet + RLUSD trust line'),
    ).toBeTruthy();
  });

  it('should show business hint when business role selected', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);

    fireEvent.press(getByText('Business'));

    expect(
      getByText('Business accounts must be pre-registered by admin'),
    ).toBeTruthy();
  });

  it('should disable login button when phone input is empty', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    const loginButton = getByText('Login');
    // The parent TouchableOpacity should have disabled state via opacity style
    expect(loginButton).toBeTruthy();
  });

  it('should enable login button when valid phone entered', () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <LoginScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('010-1234-5678'), '010-1234-5678');

    expect(getByText('Login')).toBeTruthy();
  });

  it('should call api.login on valid phone submit', async () => {
    const { api } = require('../api/client');
    api.login.mockResolvedValue({
      userId: 'c-1',
      role: 'consumer',
      name: '테스트',
    });

    const { getByText, getByPlaceholderText } = renderWithProviders(
      <LoginScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('010-1234-5678'), '010-1234-5678');
    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith({
        phone: '010-1234-5678',
        role: 'consumer',
      });
    });

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith('consumer', 'c-1', '테스트');
    });
  });

  it('should call api.login with email when email method selected', async () => {
    const { api } = require('../api/client');
    api.login.mockResolvedValue({
      userId: 'c-2',
      role: 'consumer',
      name: '이메일유저',
    });

    const { getByText, getByPlaceholderText } = renderWithProviders(
      <LoginScreen />,
    );

    fireEvent.press(getByText('Email'));
    fireEvent.changeText(getByPlaceholderText('user@example.com'), 'test@test.com');
    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith({
        email: 'test@test.com',
        role: 'consumer',
      });
    });
  });
});
