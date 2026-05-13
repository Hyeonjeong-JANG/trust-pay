import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConsumerDashboardScreen } from './DashboardScreen';

// Mock API
jest.mock('../../api/client', () => ({
  api: {
    getConsumerEscrows: jest.fn(),
    getBalance: jest.fn().mockResolvedValue({ xrplAddress: 'rTest1234', balance: '10000' }),
    approveChargeRequest: jest.fn(),
    rejectChargeRequest: jest.fn(),
  },
}));

jest.mock('../../utils/toast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

// Mock auth store
jest.mock('../../store/auth', () => ({
  useAuthStore: (selector: any) =>
    selector({ role: 'consumer', userId: 'consumer-1', name: '테스트' }),
}));

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
} as any;

const queryClients: QueryClient[] = [];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  queryClients.push(queryClient);
  const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
  return {
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    ),
    queryClient,
    invalidateQueries,
  };
}

describe('ConsumerDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { api } = require('../../api/client');
    api.getBalance.mockResolvedValue({ xrplAddress: 'rTest1234ABCDEF', balance: '10000' });
    api.approveChargeRequest.mockResolvedValue({ id: 'charge-1', status: 'settled' });
    api.rejectChargeRequest.mockResolvedValue({ id: 'charge-1', status: 'rejected' });
  });

  afterEach(() => {
    cleanup();
    queryClients.forEach((client) => client.clear());
    queryClients.length = 0;
  });

  it('should explain protected checkout instead of presenting RLUSD as a top-up balance', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);

    const { findByText, queryByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('보호 결제 원장 상태')).toBeTruthy();
    expect(await findByText('기술 검증용 잔액 10,000 RLUSD')).toBeTruthy();
    expect(await findByText(/카드·계좌 결제가 TrustPay를 거쳐야 보호됩니다/)).toBeTruthy();
    expect(await findByText(/현금이나 가게 단말기 직접 결제는 보호 대상이 아닙니다/)).toBeTruthy();
    expect(queryByText('XRPL Testnet RLUSD 잔액')).toBeNull();
  });

  it('should render title after loading', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);

    const { findByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );
    expect(await findByText('내 선불 보호')).toBeTruthy();
  });

  it('should show FAB button after loading', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);

    const { findByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );
    expect(await findByText('+')).toBeTruthy();
  });

  it('should show active-empty state message when no active escrows', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);

    const { findByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('진행중인 보호가 없습니다')).toBeTruthy();
    expect(await findByText(/완료·취소된 보호는 상단 필터에서 확인할 수 있습니다/)).toBeTruthy();
  });

  it('should default the home list to active escrows while keeping all filter chips visible', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([
      {
        id: 'e-active',
        totalAmount: 150,
        monthlyAmount: 5,
        months: 30,
        escrowType: 'prepaid',
        status: 'active',
        business: { name: '진행중 카페' },
        entries: [{ id: 'p-1', amount: '5', status: 'pending' }],
      },
      {
        id: 'e-completed',
        totalAmount: 150,
        monthlyAmount: 5,
        months: 30,
        escrowType: 'prepaid',
        status: 'completed',
        business: { name: '완료 카페' },
        entries: [{ id: 'r-1', amount: '5', status: 'released' }],
      },
    ]);

    const { findByText, findAllByText, queryByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('전체')).toBeTruthy();
    expect((await findAllByText('진행중')).length).toBeGreaterThan(0);
    expect((await findAllByText('완료')).length).toBeGreaterThan(0);
    expect(await findByText('취소됨')).toBeTruthy();
    expect(await findByText('진행중 카페')).toBeTruthy();
    expect(queryByText('완료 카페')).toBeNull();
  });

  it('should render escrow cards with business name and amount', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([
      {
        id: 'e-1',
        totalAmount: 150000,
        months: 3,
        escrowType: 'monthly',
        status: 'active',
        business: { name: '테스트카페' },
        entries: [
          { status: 'released' },
          { status: 'pending' },
          { status: 'pending' },
        ],
      },
    ]);

    const { findByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('테스트카페')).toBeTruthy();
    expect(await findByText('월정액 정산')).toBeTruthy();
    expect(await findByText('1/3개월 릴리즈됨')).toBeTruthy();
    expect(await findByText('대기 보호금 ₩135,000,000')).toBeTruthy();
    expect(await findByText('100,000.00 RLUSD')).toBeTruthy();
  });

  it('should render prepaid escrow progress by usage count', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([
      {
        id: 'e-prepaid',
        totalAmount: 150,
        monthlyAmount: 5,
        months: 30,
        escrowType: 'prepaid',
        status: 'active',
        business: { name: '강남 블루보틀' },
        entries: [
          ...Array.from({ length: 8 }, (_, index) => ({ id: `r-${index}`, amount: '5', status: 'released' })),
          ...Array.from({ length: 22 }, (_, index) => ({ id: `p-${index}`, amount: '5', status: 'pending' })),
        ],
      },
    ]);

    const { findByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('강남 블루보틀')).toBeTruthy();
    expect(await findByText('이용권 차감')).toBeTruthy();
    expect(await findByText('₩202,500')).toBeTruthy();
    expect(await findByText('8/30회 사용됨')).toBeTruthy();
    expect(await findByText('대기 보호금 ₩148,500')).toBeTruthy();
    expect(await findByText('110.00 RLUSD')).toBeTruthy();
  });

  it('should surface pending charge approvals on escrow cards', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([
      {
        id: 'e-prepaid',
        totalAmount: 300,
        monthlyAmount: 10,
        months: 30,
        escrowType: 'prepaid',
        status: 'active',
        business: { name: '헤어살롱 루나' },
        entries: [
          { id: 'p-1', amount: '10', status: 'pending' },
        ],
        chargeRequests: [
          { id: 'charge-1', menuName: '클리닉', amount: 50, status: 'pending_approval' },
        ],
      },
    ]);

    const { findByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('승인 대기 1건')).toBeTruthy();
  });

  it('should surface a push-style on-site charge approval and approve it from home', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([
      {
        id: 'e-prepaid',
        totalAmount: 300,
        monthlyAmount: 10,
        months: 30,
        escrowType: 'prepaid',
        status: 'active',
        business: { name: '헤어살롱 루나' },
        entries: [{ id: 'p-1', amount: '10', status: 'pending' }],
        chargeRequests: [
          { id: 'charge-1', menuName: '클리닉', amount: 50, status: 'pending_approval' },
        ],
      },
    ]);

    const { findByText, invalidateQueries } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('푸시 승인 대기')).toBeTruthy();
    expect(await findByText('헤어살롱 루나에서 클리닉 ₩67,500 차감 요청')).toBeTruthy();
    expect(await findByText('50.00 RLUSD')).toBeTruthy();
    fireEvent.press(await findByText('승인하고 정산'));

    await waitFor(() => {
      expect(api.approveChargeRequest).toHaveBeenCalledWith('charge-1');
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['escrow', 'e-prepaid'] });
    });
  });
});
