import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessProfileScreen } from './BusinessProfileScreen';

const mockClearAuth = jest.fn();

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('../../api/client', () => ({
  api: {
    getBalance: jest.fn().mockResolvedValue({ xrplAddress: 'rBusiness123456', balance: '1200' }),
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
    fireEvent.press(await findByText('로그아웃'));

    await waitFor(() => {
      expect(clearQueryCache).toHaveBeenCalled();
      expect(mockClearAuth).toHaveBeenCalled();
    });
  });
});
