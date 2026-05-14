import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RealtimeNotificationCenter } from './RealtimeNotificationCenter';

const mockAuthState = { role: 'consumer' as 'consumer' | 'business' | null, userId: 'c-1' };
const mockAppState = {
  realtimeNotificationSeenIds: [] as string[],
  markRealtimeNotificationSeen: jest.fn((id: string) => {
    if (!mockAppState.realtimeNotificationSeenIds.includes(id)) {
      mockAppState.realtimeNotificationSeenIds.push(id);
    }
  }),
};

jest.mock('../api/client', () => ({
  api: {
    getConsumerEscrows: jest.fn(),
    getBusinessDashboard: jest.fn(),
  },
}));

jest.mock('../store/auth', () => ({
  useAuthStore: (selector: any) => selector(mockAuthState),
}));

jest.mock('../store/app', () => ({
  useAppStore: (selector: any) => selector(mockAppState),
}));

function renderWithClient(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <RealtimeNotificationCenter />
    </QueryClientProvider>,
  );
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('RealtimeNotificationCenter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.role = 'consumer';
    mockAuthState.userId = 'c-1';
    mockAppState.realtimeNotificationSeenIds = [];
  });

  it('should show a popup when a new consumer charge approval request arrives', async () => {
    const { api } = require('../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const screen = renderWithClient(client);

    await waitFor(() => expect(api.getConsumerEscrows).toHaveBeenCalledWith('c-1'));
    await waitFor(() => expect(client.getQueryData(['consumerEscrows', 'c-1'])).toEqual([]));
    await flushEffects();

    act(() => {
      client.setQueryData(['consumerEscrows', 'c-1'], [{
        id: 'e-prepaid',
        business: { name: '강남 블루보틀' },
        chargeRequests: [{ id: 'charge-1', menuName: '아메리카노', amount: 20, status: 'pending_approval' }],
        entries: [],
      }]);
    });

    expect(await screen.findByText('차감 승인 요청 도착')).toBeTruthy();
    expect(await screen.findByText('강남 블루보틀에서 아메리카노 ₩27,000 차감 승인을 요청했습니다.')).toBeTruthy();
    fireEvent.press(await screen.findByText('확인'));
    expect(screen.queryByText('차감 승인 요청 도착')).toBeNull();
    expect(mockAppState.markRealtimeNotificationSeen).toHaveBeenCalledWith('consumer-charge-charge-1');
  });

  it('should show a popup when a business charge request is approved', async () => {
    const { api } = require('../api/client');
    mockAuthState.role = 'business';
    mockAuthState.userId = 'b-1';
    api.getBusinessDashboard.mockResolvedValue({ business: { id: 'b-1', name: '카페' }, escrows: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const screen = renderWithClient(client);

    await waitFor(() => expect(api.getBusinessDashboard).toHaveBeenCalledWith('b-1'));
    await waitFor(() => expect(client.getQueryData(['businessDashboard', 'b-1'])).toEqual({ business: { id: 'b-1', name: '카페' }, escrows: [] }));
    await flushEffects();

    act(() => {
      client.setQueryData(['businessDashboard', 'b-1'], {
        business: { id: 'b-1', name: '카페' },
        escrows: [{
          id: 'e-prepaid',
          consumer: { name: '김민수' },
          chargeRequests: [{ id: 'charge-1', menuName: '브런치 세트', amount: 15, status: 'settled' }],
          entries: [],
        }],
      });
    });

    expect(await screen.findByText('차감 정산 완료')).toBeTruthy();
    expect(await screen.findByText('김민수님이 브런치 세트 ₩20,250 차감을 승인했습니다.')).toBeTruthy();
  });

  it('should show a popup when a business charge request is rejected', async () => {
    const { api } = require('../api/client');
    mockAuthState.role = 'business';
    mockAuthState.userId = 'b-1';
    api.getBusinessDashboard.mockResolvedValue({ business: { id: 'b-1', name: '카페' }, escrows: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const screen = renderWithClient(client);

    await waitFor(() => expect(api.getBusinessDashboard).toHaveBeenCalledWith('b-1'));
    await waitFor(() => expect(client.getQueryData(['businessDashboard', 'b-1'])).toEqual({ business: { id: 'b-1', name: '카페' }, escrows: [] }));
    await flushEffects();

    act(() => {
      client.setQueryData(['businessDashboard', 'b-1'], {
        business: { id: 'b-1', name: '카페' },
        escrows: [{
          id: 'e-prepaid',
          consumer: { name: '김민수' },
          chargeRequests: [{ id: 'charge-2', menuName: '브런치 세트', amount: 15, status: 'rejected' }],
          entries: [],
        }],
      });
    });

    expect(await screen.findByText('차감 요청 거절')).toBeTruthy();
    expect(await screen.findByText('김민수님이 브런치 세트 ₩20,250 차감 요청을 거절했습니다.')).toBeTruthy();
  });

  it('should show a popup when a consumer requests refund review', async () => {
    const { api } = require('../api/client');
    mockAuthState.role = 'business';
    mockAuthState.userId = 'b-1';
    api.getBusinessDashboard.mockResolvedValue({ business: { id: 'b-1', name: '카페' }, escrows: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const screen = renderWithClient(client);

    await waitFor(() => expect(api.getBusinessDashboard).toHaveBeenCalledWith('b-1'));
    await waitFor(() => expect(client.getQueryData(['businessDashboard', 'b-1'])).toEqual({ business: { id: 'b-1', name: '카페' }, escrows: [] }));
    await flushEffects();

    act(() => {
      client.setQueryData(['businessDashboard', 'b-1'], {
        business: { id: 'b-1', name: '카페' },
        escrows: [{
          id: 'e-refund',
          consumer: { name: '김민수' },
          chargeRequests: [],
          entries: [],
          refundReviewRequests: [{
            id: 'refund-review-1',
            status: 'merchant_review',
            refundableAmount: 10,
            consumerReason: '2주 넘게 문을 열지 않아 환불 검토를 요청합니다.',
            requestedAt: new Date().toISOString(),
          }],
        }],
      });
    });

    expect(await screen.findByText('환불 검토 요청 도착')).toBeTruthy();
    expect(await screen.findByText('김민수님이 ₩13,500 환불 검토를 요청했습니다.')).toBeTruthy();
    fireEvent.press(await screen.findByText('확인'));
    expect(mockAppState.markRealtimeNotificationSeen).toHaveBeenCalledWith('business-refund-review-refund-review-1');
  });

  it('should show a popup when a consumer approves a new protected payment', async () => {
    const { api } = require('../api/client');
    mockAuthState.role = 'business';
    mockAuthState.userId = 'b-1';
    api.getBusinessDashboard.mockResolvedValue({ business: { id: 'b-1', name: '카페' }, escrows: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const screen = renderWithClient(client);

    await waitFor(() => expect(api.getBusinessDashboard).toHaveBeenCalledWith('b-1'));
    await waitFor(() => expect(client.getQueryData(['businessDashboard', 'b-1'])).toEqual({ business: { id: 'b-1', name: '카페' }, escrows: [] }));
    await flushEffects();

    act(() => {
      client.setQueryData(['businessDashboard', 'b-1'], {
        business: { id: 'b-1', name: '카페' },
        escrows: [{
          id: 'e-new',
          status: 'active',
          totalAmount: 150,
          consumer: { name: '이서연' },
          chargeRequests: [],
          entries: [],
        }],
      });
    });

    expect(await screen.findByText('보호 결제 승인')).toBeTruthy();
    expect(await screen.findByText('이서연님이 ₩202,500 보호 결제를 승인했습니다.')).toBeTruthy();
  });

  it('should not show a previously confirmed popup after remounting', async () => {
    const { api } = require('../api/client');
    mockAuthState.role = 'business';
    mockAuthState.userId = 'b-1';
    mockAppState.realtimeNotificationSeenIds = ['business-charge-charge-1'];
    api.getBusinessDashboard.mockResolvedValue({
      business: { id: 'b-1', name: '카페' },
      escrows: [{
        id: 'e-prepaid',
        consumer: { name: '김민수' },
        chargeRequests: [{ id: 'charge-1', menuName: '브런치 세트', amount: 15, status: 'settled' }],
        entries: [],
      }],
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const screen = renderWithClient(client);

    await waitFor(() => expect(api.getBusinessDashboard).toHaveBeenCalledWith('b-1'));

    expect(screen.queryByText('차감 정산 완료')).toBeNull();
    expect(screen.queryByText('김민수님이 브런치 세트 ₩20,250 차감을 승인했습니다.')).toBeNull();
  });
});
