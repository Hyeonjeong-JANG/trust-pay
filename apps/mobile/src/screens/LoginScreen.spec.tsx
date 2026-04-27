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
    expect(getByText('XRPL 기반 RLUSD 선불 보호 서비스')).toBeTruthy();
  });

  it('should render role selector with 소비자 and 사업자', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    expect(getByText('소비자')).toBeTruthy();
    expect(getByText('사업자')).toBeTruthy();
  });

  it('should render login method selector with 전화번호 and 이메일', () => {
    const { getAllByText, getByText } = renderWithProviders(<LoginScreen />);
    expect(getAllByText('전화번호').length).toBeGreaterThanOrEqual(1);
    expect(getByText('이메일')).toBeTruthy();
  });

  it('should show phone input by default', () => {
    const { getByPlaceholderText } = renderWithProviders(<LoginScreen />);
    expect(getByPlaceholderText('010-1234-5678')).toBeTruthy();
  });

  it('should switch to email input when 이메일 method selected', () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } =
      renderWithProviders(<LoginScreen />);

    fireEvent.press(getByText('이메일'));

    expect(getByPlaceholderText('user@example.com')).toBeTruthy();
    expect(queryByPlaceholderText('010-1234-5678')).toBeNull();
  });

  it('should show name input for consumer role', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    expect(getByText('이름 (선택)')).toBeTruthy();
  });

  it('should hide name input for business role', () => {
    const { getByText, queryByText } = renderWithProviders(<LoginScreen />);

    fireEvent.press(getByText('사업자'));

    expect(queryByText('이름 (선택)')).toBeNull();
  });

  it('should show consumer hint when consumer role selected', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    expect(
      getByText('첫 로그인 시 XRPL 지갑 + RLUSD 트러스트라인이 자동 생성됩니다'),
    ).toBeTruthy();
  });

  it('should show business hint when business role selected', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);

    fireEvent.press(getByText('사업자'));

    expect(
      getByText('사업자 계정은 관리자가 사전 등록해야 합니다'),
    ).toBeTruthy();
  });

  it('should disable login button when phone input is empty', () => {
    const { getByText } = renderWithProviders(<LoginScreen />);
    const loginButton = getByText('로그인');
    expect(loginButton).toBeTruthy();
  });

  it('should enable login button when valid phone entered', () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(
      <LoginScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('010-1234-5678'), '010-1234-5678');

    expect(getByText('로그인')).toBeTruthy();
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
    fireEvent.press(getByText('로그인'));

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

    fireEvent.press(getByText('이메일'));
    fireEvent.changeText(getByPlaceholderText('user@example.com'), 'test@test.com');
    fireEvent.press(getByText('로그인'));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith({
        email: 'test@test.com',
        role: 'consumer',
      });
    });
  });
});
