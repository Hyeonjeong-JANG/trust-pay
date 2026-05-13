import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessDashboardScreen } from './BusinessDashboardScreen';

jest.mock('../../utils/toast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../../api/client', () => ({
  api: {
    getBusinessDashboard: jest.fn(),
    getBalance: jest.fn().mockResolvedValue({ xrplAddress: 'rBusiness123456', balance: '1200' }),
    finishEscrow: jest.fn(),
    createChargeRequest: jest.fn(),
    getBusinessProducts: jest.fn(),
    createPaymentRequest: jest.fn(),
  },
}));

jest.mock('../../store/auth', () => ({
  useAuthStore: (selector: any) => selector({ userId: 'business-1', role: 'business', name: '파워짐' }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('BusinessDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { api } = require('../../api/client');
    api.getBusinessProducts.mockResolvedValue([]);
    api.finishEscrow.mockResolvedValue({ txHash: 'AUTO_FINISH_TX' });
  });

  it('should periodically refresh the dashboard so merchant screens reflect customer approvals', async () => {
    jest.useFakeTimers();
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 0,
      escrows: [],
    });

    try {
      const { findByText, queryByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

      expect(await findByText('진행중 에스크로 (0건)')).toBeTruthy();
      expect(queryByText('QR 결제 만들기')).toBeNull();
      expect(queryByText('결제 금액')).toBeNull();
      expect(api.getBusinessDashboard).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => expect(api.getBusinessDashboard).toHaveBeenCalledTimes(2));
    } finally {
      jest.useRealTimers();
    }
  });

  it('should automatically receive eligible monthly settlements without a manual receive button', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 300,
      totalPending: 300,
      escrows: [
        {
          id: 'e-1',
          status: 'active',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-1', name: '김민수' },
          entries: [
            { id: 'en-1', month: 1, amount: '100', status: 'pending', finishAfter: 830607775 },
          ],
        },
      ],
    });

    const { findAllByText, findByText, queryByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText(/EscrowFinish로 수령 가능한 월차/)).toBeTruthy();
    expect((await findAllByText('100.00 RLUSD')).length).toBeGreaterThan(0);
    expect(queryByText('1월차 수령 가능 (₩135,000)')).toBeNull();
    await waitFor(() => {
      expect(api.finishEscrow).toHaveBeenCalledWith('e-1', 1);
    });
  });

  it('should open business escrow detail from an escrow card', async () => {
    const { api } = require('../../api/client');
    const navigation = { navigate: jest.fn() };
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 600,
      escrows: [
        {
          id: 'e-detail',
          status: 'active',
          escrowType: 'monthly',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-1', name: '김민수' },
          entries: [
            { id: 'en-1', month: 1, amount: '100', status: 'pending', finishAfter: 830607775 },
          ],
        },
      ],
    });

    const { findByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={navigation as any} />);

    fireEvent.press(await findByText('김민수'));

    expect(navigation.navigate).toHaveBeenCalledWith('BusinessEscrowDetail', { id: 'e-detail' });
  });

  it('should default to the active escrow filter when a merchant opens the dashboard', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 600,
      totalPending: 600,
      escrows: [
        {
          id: 'e-active',
          status: 'active',
          escrowType: 'monthly',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-active', name: '김민수' },
          entries: [
            { id: 'en-active', month: 1, amount: '100', status: 'pending', finishAfter: 830607775 },
          ],
        },
        {
          id: 'e-completed',
          status: 'completed',
          escrowType: 'monthly',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-completed', name: '완료 고객' },
          entries: [
            { id: 'en-completed', month: 1, amount: '100', status: 'released', finishAfter: 830607775 },
          ],
        },
      ],
    });

    const { findByText, queryByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText('진행중 에스크로 (1건)')).toBeTruthy();
    expect(await findByText('김민수')).toBeTruthy();
    expect(queryByText('완료 고객')).toBeNull();
  });

  it('should keep prepaid charge controls out of dashboard cards', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 25,
      totalPending: 125,
      escrows: [
        {
          id: 'e-prepaid',
          status: 'active',
          escrowType: 'prepaid',
          totalAmount: 150,
          monthlyAmount: 5,
          months: 30,
          unitPrice: 5,
          validityMonths: 3,
          product: {
            id: 'product-cafe',
            menuItems: [
              { id: 'menu-americano', name: '아메리카노', amount: 5 },
              { id: 'menu-brunch', name: '브런치 세트', amount: 15 },
            ],
          },
          consumer: { id: 'consumer-2', name: '이서연' },
          entries: [
            { id: 'en-1', month: 9, amount: '5', status: 'pending', finishAfter: 830607775 },
            { id: 'en-2', month: 10, amount: '5', status: 'pending', finishAfter: 830607775 },
            { id: 'en-3', month: 11, amount: '5', status: 'pending', finishAfter: 830607775 },
          ],
          chargeRequests: [
            { id: 'charge-1', menuName: '아메리카노', amount: 10, status: 'settled' },
            { id: 'charge-2', menuName: '브런치 세트', amount: 15, status: 'settled' },
          ],
        },
      ],
    });

    const { findByText, queryByText, queryByPlaceholderText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText(/이미 보호 원장에 잠긴 금액권에서 실제 사용금액 차감 요청을 보냅니다/)).toBeTruthy();
    expect(await findByText('사용 ₩33,750 · 잔액 ₩168,750')).toBeTruthy();
    expect(await findByText('25.00 RLUSD 사용 · 125.00 RLUSD 잔액')).toBeTruthy();
    expect(queryByText(/\/회/)).toBeNull();
    expect(queryByText(/건 대기/)).toBeNull();
    expect(queryByText('차감 메뉴 등록')).toBeNull();
    expect(queryByText('차감 항목 선택')).toBeNull();
    expect(queryByText('직접 입력')).toBeNull();
    expect(queryByText('이용금액 직접 입력')).toBeNull();
    expect(queryByText('고객 이용분 승인 요청')).toBeNull();
    expect(queryByPlaceholderText('예: 수건 대여')).toBeNull();
    expect(queryByPlaceholderText('예: 67,500')).toBeNull();
  });

  it('should not expose monthly auto-settlement copy inside each dashboard card', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 600,
      escrows: [
        {
          id: 'e-monthly-copy',
          status: 'active',
          escrowType: 'monthly',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-1', name: '김민수' },
          entries: [
            { id: 'en-1', month: 1, amount: '100', status: 'pending', finishAfter: 830607775 },
          ],
        },
      ],
    });

    const { findByText, queryByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText('김민수')).toBeTruthy();
    expect(queryByText('조건 충족 월차는 사업자 조작 없이 자동 수령됩니다.')).toBeNull();
  });
});
