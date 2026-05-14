import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessProfileScreen } from './BusinessProfileScreen';

const mockClearAuth = jest.fn();

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('../../utils/toast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../../api/client', () => ({
  api: {
    getBalance: jest.fn().mockResolvedValue({ xrplAddress: 'rBusiness123456', balance: '1200' }),
    getBusiness: jest.fn().mockResolvedValue({
      id: 'business-1',
      name: '파워짐 피트니스',
      category: '헬스장',
      address: '서울시 서초구 서초대로 100',
      registrationNumber: '1234567890',
      registrationVerificationStatus: 'demo_verified',
    }),
  },
}));

jest.mock('../../store/auth', () => ({
  useAuthStore: (selector: any) => selector({
    userId: 'business-1',
    role: 'business',
    name: '파워짐',
    clearAuth: mockClearAuth,
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const clearQueryCache = jest.spyOn(queryClient, 'clear');
  const result = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { ...result, clearQueryCache };
}

describe('BusinessProfileScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should keep logout inside the merchant profile screen', async () => {
    const { findByText, clearQueryCache } = renderWithProviders(
      <BusinessProfileScreen route={{} as any} navigation={{} as any} />,
    );

    expect(await findByText('파워짐')).toBeTruthy();
    expect(await findByText('1,200 RLUSD')).toBeTruthy();
    fireEvent.press(await findByText('로그아웃'));

    await waitFor(() => {
      expect(clearQueryCache).toHaveBeenCalled();
      expect(mockClearAuth).toHaveBeenCalled();
    });
  });

  it('should manage multiple prepaid charge menus from store management', async () => {
    const { findByPlaceholderText, findByText } = renderWithProviders(
      <BusinessProfileScreen route={{} as any} navigation={{} as any} />,
    );

    expect(await findByText('가게관리')).toBeTruthy();
    expect(await findByText('사업자 정보')).toBeTruthy();
    expect(await findByText('123-45-67890')).toBeTruthy();
    expect(await findByText('국세청 데모 인증 완료')).toBeTruthy();
    expect(await findByText('1,200 RLUSD')).toBeTruthy();
    expect(await findByText('차감 메뉴 등록')).toBeTruthy();

    fireEvent.changeText(await findByPlaceholderText('예: PT 1회'), 'PT 1회');
    fireEvent.changeText(await findByPlaceholderText('예: 67,500'), '67500');
    fireEvent.press(await findByText('메뉴 추가'));

    fireEvent.changeText(await findByPlaceholderText('예: PT 1회'), '락커 대여');
    fireEvent.changeText(await findByPlaceholderText('예: 67,500'), '2500');
    fireEvent.press(await findByText('메뉴 추가'));

    expect(await findByText('PT 1회 · ₩67,500')).toBeTruthy();
    expect(await findByText('락커 대여 · ₩2,500')).toBeTruthy();
  });
});
