import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RealtimeNotificationCenter } from './RealtimeNotificationCenter';

const mockAuthState = { role: 'consumer' as 'consumer' | 'business' | null, userId: 'c-1' };

jest.mock('../api/client', () => ({
  api: {
    getConsumerEscrows: jest.fn(),
    getBusinessDashboard: jest.fn(),
  },
}));

jest.mock('../store/auth', () => ({
  useAuthStore: (selector: any) => selector(mockAuthState),
}));

function renderWithClient(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <RealtimeNotificationCenter />
    </QueryClientProvider>,
  );
}

describe('RealtimeNotificationCenter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.role = 'consumer';
    mockAuthState.userId = 'c-1';
  });

  it('should show a popup when a new consumer charge approval request arrives', async () => {
    const { api } = require('../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const screen = renderWithClient(client);

    await waitFor(() => expect(api.getConsumerEscrows).toHaveBeenCalledWith('c-1'));

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
  });

  it('should show a popup when a business charge request is approved', async () => {
    const { api } = require('../api/client');
    mockAuthState.role = 'business';
    mockAuthState.userId = 'b-1';
    api.getBusinessDashboard.mockResolvedValue({ business: { id: 'b-1', name: '카페' }, escrows: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const screen = renderWithClient(client);

    await waitFor(() => expect(api.getBusinessDashboard).toHaveBeenCalledWith('b-1'));

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

  it('should show a popup when a consumer approves a new protected payment', async () => {
    const { api } = require('../api/client');
    mockAuthState.role = 'business';
    mockAuthState.userId = 'b-1';
    api.getBusinessDashboard.mockResolvedValue({ business: { id: 'b-1', name: '카페' }, escrows: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const screen = renderWithClient(client);

    await waitFor(() => expect(api.getBusinessDashboard).toHaveBeenCalledWith('b-1'));

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
});
