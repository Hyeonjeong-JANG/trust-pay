import React from 'react';
import { act, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationsScreen } from './NotificationsScreen';

// Mock API
jest.mock('../../api/client', () => ({
  api: {
    getConsumerEscrows: jest.fn(),
  },
}));

// Mock auth store
jest.mock('../../store/auth', () => ({
  useAuthStore: (selector: any) =>
    selector({ role: 'consumer', userId: 'consumer-1', name: '테스트' }),
}));

// Mock app store
const mockSetNotificationsLastViewed = jest.fn();
jest.mock('../../store/app', () => ({
  useAppStore: (selector: any) =>
    selector({
      notificationsLastViewed: 0,
      setNotificationsLastViewed: mockSetNotificationsLastViewed,
    }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('NotificationsScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('should render empty state when no escrows', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);

    const { findByText } = renderWithProviders(<NotificationsScreen />);

    expect(await findByText('알림이 없습니다')).toBeTruthy();
    expect(await findByText('에스크로 활동 알림이 여기에 표시됩니다')).toBeTruthy();
  });

  it('should call setNotificationsLastViewed on mount', () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);

    renderWithProviders(<NotificationsScreen />);

    expect(mockSetNotificationsLastViewed).toHaveBeenCalled();
  });

  it('should render notification items from escrow data', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([
      {
        id: 'e-1',
        totalAmount: 600,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        business: { name: '파워짐 헬스장' },
        entries: [
          {
            id: 'entry-1',
            month: 1,
            amount: '100',
            status: 'released',
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    ]);

    const { findByText } = renderWithProviders(<NotificationsScreen />);

    expect(await findByText('보호 결제 시작')).toBeTruthy();
    expect(await findByText('릴리즈 완료')).toBeTruthy();
    expect(await findByText(/계좌 승인 결제 후 파워짐 헬스장 보호 원장에 600 RLUSD가 잠겼습니다/)).toBeTruthy();
    expect(await findByText(/EscrowFinish로 100 RLUSD가 릴리즈되었습니다/)).toBeTruthy();
  });
});
