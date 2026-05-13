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

  it('should show prepaid settlement as per-use receipt', async () => {
    const { api } = require('../../api/client');
    api.createChargeRequest.mockResolvedValue({ id: 'charge-1', status: 'pending_approval' });
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 40,
      totalPending: 110,
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
        },
      ],
    });

    const { findAllByText, findByPlaceholderText, findByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText(/이미 보호 원장에 잠긴 이용권에서 이용분 차감 요청을 보냅니다/)).toBeTruthy();
    expect(await findByText('차감 메뉴 등록')).toBeTruthy();
    expect(await findByText('차감 항목 선택')).toBeTruthy();
    expect(await findByText('직접 입력')).toBeTruthy();
    expect((await findAllByText('이용금액 직접 입력')).length).toBeGreaterThan(0);
    expect(await findByText('고객 이용분 승인 요청')).toBeTruthy();
    expect(await findByText(/₩6,750\/회/)).toBeTruthy();
    expect((await findAllByText('5.00 RLUSD')).length).toBeGreaterThan(0);
    fireEvent.changeText(await findByPlaceholderText('예: 수건 대여'), '락커 대여');
    fireEvent.changeText(await findByPlaceholderText('예: 67,500'), '6750');
    fireEvent.press(await findByText('직접 입력 승인 요청'));

    await waitFor(() => {
      expect(api.createChargeRequest).toHaveBeenCalledWith('e-prepaid', {
        menuName: '락커 대여',
        amount: 5,
      });
      const { showSuccessToast } = require('../../utils/toast');
      expect(showSuccessToast).toHaveBeenCalledWith('이용분 승인 요청 전송', '소비자 승인 대기 상태로 등록되었습니다.');
    });
  });

  it('should add multiple merchant menus and request a selected menu from the dropdown', async () => {
    const { api } = require('../../api/client');
    api.createChargeRequest.mockResolvedValue({ id: 'charge-menu', status: 'pending_approval' });
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 814.81481,
      escrows: [
        {
          id: 'e-prepaid-menu',
          status: 'active',
          escrowType: 'prepaid',
          totalAmount: 814.81481,
          monthlyAmount: 81.481481,
          months: 10,
          unitPrice: 81.481481,
          consumer: { id: 'consumer-1', name: '김민수' },
          entries: [
            { id: 'en-1', month: 1, amount: '81.481481', status: 'pending', finishAfter: 830607775 },
            { id: 'en-2', month: 2, amount: '81.481481', status: 'pending', finishAfter: 830607775 },
          ],
        },
      ],
    });

    const { findAllByText, findByPlaceholderText, findByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText('차감 메뉴 등록')).toBeTruthy();
    fireEvent.changeText(await findByPlaceholderText('예: PT 1회'), 'PT 1회');
    fireEvent.changeText(await findByPlaceholderText('예: 110,000'), '110000');
    fireEvent.press(await findByText('메뉴 추가'));
    fireEvent.changeText(await findByPlaceholderText('예: PT 1회'), '락커 2개월');
    fireEvent.changeText(await findByPlaceholderText('예: 110,000'), '220000');
    fireEvent.press(await findByText('메뉴 추가'));

    fireEvent.press(await findByText('차감 항목 선택'));
    expect((await findAllByText('락커 2개월 · ₩220,000')).length).toBeGreaterThan(1);
    const ptOptions = await findAllByText('PT 1회 · ₩110,000');
    fireEvent.press(ptOptions[ptOptions.length - 1]);
    fireEvent.press(await findByText('선택 항목 승인 요청'));

    await waitFor(() => {
      expect(api.createChargeRequest).toHaveBeenCalledWith('e-prepaid-menu', {
        menuName: 'PT 1회',
        amount: 81.481481,
      });
    });
  });

  it('should explain prepaid unit multiples before sending an invalid direct charge request', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 814.81481,
      escrows: [
        {
          id: 'e-prepaid-invalid',
          status: 'active',
          escrowType: 'prepaid',
          totalAmount: 814.81481,
          monthlyAmount: 81.481481,
          months: 10,
          unitPrice: 81.481481,
          consumer: { id: 'consumer-1', name: '김민수' },
          entries: [
            { id: 'en-1', month: 1, amount: '81.481481', status: 'pending', finishAfter: 830607775 },
          ],
        },
      ],
    });

    const { findByPlaceholderText, findByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    fireEvent.changeText(await findByPlaceholderText('예: 수건 대여'), '수건 대여');
    fireEvent.changeText(await findByPlaceholderText('예: 67,500'), '67500');
    fireEvent.press(await findByText('직접 입력 승인 요청'));

    await waitFor(() => {
      const { showErrorToast } = require('../../utils/toast');
      expect(showErrorToast).toHaveBeenCalledWith('차감 요청 실패', expect.stringContaining('₩110,000 단위'));
      expect(api.createChargeRequest).not.toHaveBeenCalled();
    });
  });
});
