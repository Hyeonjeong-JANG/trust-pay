import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockApi = {
  getConsumerEscrows: jest.fn(),
  getBusinessDashboard: jest.fn(),
};

const mockAuthState = {
  role: 'business' as 'consumer' | 'business',
  userId: 'business-1',
};

const mockAppState = {
  notificationsLastViewed: 0,
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(null),
  },
}));
jest.mock('../api/client', () => ({ api: mockApi }));
jest.mock('../store/auth', () => ({
  useAuthStore: (selector: any) => selector(mockAuthState),
}));
jest.mock('../store/app', () => ({
  useAppStore: (selector: any) => selector(mockAppState),
}));

const { useUnreadCount } = require('./useUnreadCount') as typeof import('./useUnreadCount');

function CountProbe() {
  const unread = useUnreadCount();
  return <Text>{unread}</Text>;
}

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CountProbe />
    </QueryClientProvider>,
  );
}

describe('useUnreadCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.role = 'business';
    mockAuthState.userId = 'business-1';
    mockAppState.notificationsLastViewed = new Date('2026-01-01T00:00:00.000Z').getTime();
  });

  it('uses the business dashboard and counts active merchant refund review requests for business users', async () => {
    mockApi.getConsumerEscrows.mockResolvedValue([]);
    mockApi.getBusinessDashboard.mockResolvedValue({
      business: { id: 'business-1', name: '파워짐' },
      escrows: [
        {
          id: 'escrow-1',
          status: 'active',
          createdAt: '2025-12-31T23:59:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
          entries: [],
          chargeRequests: [],
          refundReviewRequests: [
            {
              id: 'refund-review-1',
              status: 'merchant_response_requested',
              refundableAmount: 10,
              requestedAt: '2026-01-02T00:00:00.000Z',
            },
          ],
        },
      ],
    });

    const { findByText } = renderWithProviders();

    await waitFor(() => expect(mockApi.getBusinessDashboard).toHaveBeenCalledWith('business-1'));
    expect(mockApi.getConsumerEscrows).not.toHaveBeenCalled();
    expect(await findByText('1')).toBeTruthy();
  });

  it('counts platform-review refund requests as unread for merchants', async () => {
    mockApi.getBusinessDashboard.mockResolvedValue({
      business: { id: 'business-1', name: '파워짐' },
      escrows: [
        {
          id: 'e-refund-platform',
          status: 'completed',
          createdAt: '2026-05-12T00:00:00.000Z',
          entries: [],
          chargeRequests: [],
          refundReviewRequests: [
            {
              id: 'refund-review-platform',
              status: 'platform_review',
              refundableAmount: 10,
              requestedAt: '2026-05-14T00:00:00.000Z',
            },
          ],
        },
      ],
    });
    mockAppState.notificationsLastViewed = new Date('2026-05-13T00:00:00.000Z').getTime();

    const { findByText } = renderWithProviders();

    await waitFor(() => expect(mockApi.getBusinessDashboard).toHaveBeenCalledWith('business-1'));
    expect(await findByText('1')).toBeTruthy();
  });
});
