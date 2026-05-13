import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConsumerDashboardScreen } from './DashboardScreen';

// Mock API
jest.mock('../../api/client', () => ({
  api: {
    getConsumerEscrows: jest.fn(),
    getBalance: jest.fn().mockResolvedValue({ xrplAddress: 'rTest1234', balance: '10000' }),
  },
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

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('ConsumerDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(await findByText('대기 보호금 100,000 RLUSD')).toBeTruthy();
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
    expect(await findByText('8/30회 사용됨')).toBeTruthy();
    expect(await findByText('대기 보호금 110 RLUSD')).toBeTruthy();
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
});
