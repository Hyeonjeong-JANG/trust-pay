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

  it('should greet the signed-in consumer and keep the protected payment card concise', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);

    const { findAllByText, findByText, queryByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('테스트님, 안녕하세요')).toBeTruthy();
    expect(await findByText('계좌 승인 결제')).toBeTruthy();
    expect(await findByText('승인하면 보호 시작')).toBeTruthy();
    expect(await findByText('선불금은 이용 전까지 잠겨 있어요')).toBeTruthy();
    expect(queryByText('연결 계좌 승인 가능')).toBeNull();
    expect(queryByText(/앱푸시 승인 후 결제 금액/)).toBeNull();
    expect(queryByText(/카드는 보조 옵션/)).toBeNull();
    expect(queryByText(/보호 원장 10,000 RLUSD/)).toBeNull();
    expect(queryByText(/기술 검증용 잔액/)).toBeNull();
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

  it('should route consumers to QR scan checkout instead of business selection', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);

    const { findByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );
    fireEvent.press(await findByText('QR 스캔 결제'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('ScanPayment');
  });

  it('should show active-empty state message when no active escrows', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);

    const { findByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('진행중인 보호가 없습니다')).toBeTruthy();
    expect(await findByText(/사업자가 제시한 QR을 스캔해 보호 결제를 시작하세요/)).toBeTruthy();
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

    const { findByText, queryByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('테스트카페')).toBeTruthy();
    expect(await findByText('월정액 정산')).toBeTruthy();
    expect(await findByText('정산 ₩67,500,000 · 잔여 ₩135,000,000')).toBeTruthy();
    expect(queryByText(/대기 보호금/)).toBeNull();
  });

  it('should render prepaid escrow progress by used and remaining amounts', async () => {
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
        chargeRequests: [
          { id: 'charge-1', menuName: '아메리카노', amount: 20, status: 'settled' },
          { id: 'charge-2', menuName: '브런치', amount: 17, status: 'settled' },
        ],
      },
      {
        id: 'e-prepaid-second',
        totalAmount: 300,
        monthlyAmount: 10,
        months: 30,
        escrowType: 'prepaid',
        status: 'active',
        business: { name: '헤어살롱 루나' },
        entries: [{ id: 'p-1', amount: '10', status: 'pending' }],
        chargeRequests: [],
      },
    ]);

    const { findAllByText, findByText, queryByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('강남 블루보틀')).toBeTruthy();
    expect((await findAllByText('이용권 차감')).length).toBeGreaterThan(0);
    expect(await findByText('₩202,500')).toBeTruthy();
    expect(await findByText('사용 ₩49,950 · 잔액 ₩152,550')).toBeTruthy();
    expect(await findAllByText('승인된 실제 사용금액 기준으로 잔액이 줄어듭니다')).toHaveLength(1);
    expect(queryByText(/회 사용됨/)).toBeNull();
    expect(queryByText(/대기 보호금/)).toBeNull();
    expect(queryByText(/남은 금액/)).toBeNull();
    expect(queryByText('사용 금액')).toBeNull();
    expect(queryByText('남은 잔액')).toBeNull();
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

  it('should surface refund review status on consumer escrow cards', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([
      {
        id: 'e-refund-review',
        totalAmount: 150,
        monthlyAmount: 5,
        months: 30,
        escrowType: 'prepaid',
        status: 'active',
        business: { name: '강남 블루보틀' },
        entries: [{ id: 'p-1', amount: '5', status: 'pending' }],
        refundReviewRequests: [
          {
            id: 'refund-review-1',
            status: 'platform_investigation',
            refundableAmount: 10,
            requestedAt: '2026-05-14T00:00:00.000Z',
          },
        ],
      },
    ]);

    const { findByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('강남 블루보틀')).toBeTruthy();
    expect(await findByText('환불 검토 중: TrustPay 추가 확인 중')).toBeTruthy();
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

    const { findByPlaceholderText, findByText, invalidateQueries } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('푸시 승인 대기')).toBeTruthy();
    expect(await findByText('이용분 승인 요청')).toBeTruthy();
    expect(await findByText('헤어살롱 루나에서 클리닉 ₩67,500 차감 요청')).toBeTruthy();
    expect(await findByText('50.00 RLUSD')).toBeTruthy();
    expect(await findByText(/보호 금액권 잔액에서 해당 이용금액만 정산됩니다/)).toBeTruthy();
    fireEvent.press(await findByText('승인하고 정산'));
    expect(api.approveChargeRequest).not.toHaveBeenCalled();
    expect(await findByText('결제 승인 인증')).toBeTruthy();
    fireEvent.changeText(await findByPlaceholderText('간편비밀번호 6자리'), '123456');
    fireEvent.press(await findByText('간편비밀번호로 승인'));

    await waitFor(() => {
      expect(api.approveChargeRequest).toHaveBeenCalledWith('charge-1');
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['escrow', 'e-prepaid'] });
    });
  });
});
