import React from 'react';
import { act, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationsScreen } from './NotificationsScreen';

// Mock API
jest.mock('../../api/client', () => ({
  api: {
    getConsumerEscrows: jest.fn(),
    getBusinessDashboard: jest.fn(),
  },
}));

// Mock auth store
const mockAuthState = { role: 'consumer' as 'consumer' | 'business', userId: 'consumer-1', name: '테스트' };
jest.mock('../../store/auth', () => ({
  useAuthStore: (selector: any) =>
    selector(mockAuthState),
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
    mockAuthState.role = 'consumer';
    mockAuthState.userId = 'consumer-1';
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

  it('should render business refund review notifications from dashboard data', async () => {
    const { api } = require('../../api/client');
    mockAuthState.role = 'business';
    mockAuthState.userId = 'business-1';
    api.getBusinessDashboard.mockResolvedValue({
      business: { id: 'business-1', name: '파워짐' },
      escrows: [
        {
          id: 'e-refund',
          consumer: { name: '김민수' },
          entries: [],
          refundReviewRequests: [
            {
              id: 'refund-review-1',
              status: 'merchant_review',
              refundableAmount: 10,
              consumerReason: '2주 넘게 안 열고 전화도 받지 않아 환불 검토를 요청합니다.',
              requestedAt: new Date().toISOString(),
            },
          ],
        },
      ],
    });

    const { findByText } = renderWithProviders(<NotificationsScreen />);

    expect(await findByText('환불 검토 요청')).toBeTruthy();
    expect(await findByText(/김민수님이 ₩13,500 환불 검토를 요청했습니다/)).toBeTruthy();
    expect(await findByText(/2주 넘게 안 열고 전화도 받지 않아/)).toBeTruthy();
  });
});
