import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
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
  beforeEach(() => jest.clearAllMocks());

  it('should explain EscrowFinish-based merchant settlement', async () => {
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

    const { findAllByText, findByText } = renderWithProviders(<BusinessDashboardScreen />);

    expect(await findByText(/EscrowFinish로 수령 가능한 월차/)).toBeTruthy();
    expect(await findByText('1월차 수령 가능 (₩135,000)')).toBeTruthy();
    expect((await findAllByText('100.00 RLUSD')).length).toBeGreaterThan(0);
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

    const { findAllByText, findByText } = renderWithProviders(<BusinessDashboardScreen />);

    expect(await findByText(/이미 보호 원장에 잠긴 이용권에서 이용분 차감 요청을 보냅니다/)).toBeTruthy();
    expect(await findByText('고객 이용분 승인 요청')).toBeTruthy();
    expect(await findByText(/₩6,750\/회/)).toBeTruthy();
    expect((await findAllByText('5.00 RLUSD')).length).toBeGreaterThan(0);
    fireEvent.press(await findByText('아메리카노 이용분 승인 요청 (₩6,750)'));

    await waitFor(() => {
      expect(api.createChargeRequest).toHaveBeenCalledWith('e-prepaid', { menuItemId: 'menu-americano' });
      const { showSuccessToast } = require('../../utils/toast');
      expect(showSuccessToast).toHaveBeenCalledWith('이용분 승인 요청 전송', '소비자 승인 대기 상태로 등록되었습니다.');
    });
  });
});
