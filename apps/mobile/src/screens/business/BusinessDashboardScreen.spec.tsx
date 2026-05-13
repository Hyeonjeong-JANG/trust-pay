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

    const { findAllByText, findByText, queryByText } = renderWithProviders(<BusinessDashboardScreen />);

    expect(await findByText(/EscrowFinish로 수령 가능한 월차/)).toBeTruthy();
    expect((await findAllByText('100.00 RLUSD')).length).toBeGreaterThan(0);
    expect(queryByText('1월차 수령 가능 (₩135,000)')).toBeNull();
    await waitFor(() => {
      expect(api.finishEscrow).toHaveBeenCalledWith('e-1', 1);
    });
  });

  it('should create a monthly merchant QR from only amount and month count', async () => {
    const { api } = require('../../api/client');
    api.createPaymentRequest.mockResolvedValue({
      id: 'request-1',
      code: 'TP-123456',
      businessId: 'business-1',
      businessName: '파워짐',
      paymentAmount: 600,
      totalAmount: 600,
      monthlyAmount: 100,
      months: 6,
      paymentModel: 'monthly',
      escrowType: 'monthly',
      status: 'pending',
      createdAt: '2026-05-13T00:00:00Z',
    });
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 0,
      escrows: [],
    });

    const { findByPlaceholderText, findByText, queryByText, queryByPlaceholderText } = renderWithProviders(<BusinessDashboardScreen />);

    expect(await findByText('결제 QR 만들기')).toBeTruthy();
    expect(await findByText('결제 금액')).toBeTruthy();
    fireEvent.changeText(await findByPlaceholderText('예: 810,000'), '810000');
    expect(queryByText('실제 충전 금액')).toBeNull();
    expect(queryByText('매월 정산액')).toBeNull();
    expect(queryByPlaceholderText('예: 135,000')).toBeNull();
    fireEvent.changeText(await findByPlaceholderText('예: 6'), '6');
    fireEvent.press(await findByText('QR 결제 만들기'));

    await waitFor(() => {
      expect(api.createPaymentRequest).toHaveBeenCalledWith({
        businessId: 'business-1',
        paymentAmount: 600,
        totalAmount: 600,
        monthlyAmount: 100,
        months: 6,
        paymentModel: 'monthly',
        escrowType: 'monthly',
      });
    });
    expect(await findByText('TP-123456')).toBeTruthy();
  });

  it('should create a period voucher QR with paid amount, charged amount, and validity dates', async () => {
    const { api } = require('../../api/client');
    api.createPaymentRequest.mockResolvedValue({
      id: 'request-voucher',
      code: 'TP-654321',
      businessId: 'business-1',
      businessName: '파워짐',
      paymentAmount: 66.666667,
      totalAmount: 74.074074,
      paymentModel: 'voucher',
      escrowType: 'prepaid',
      unitPrice: 7.407407,
      validityMonths: 3,
      validFrom: '2026-05-13',
      validUntil: '2026-08-13',
      status: 'pending',
      createdAt: '2026-05-13T00:00:00Z',
    });
    api.getBusinessDashboard.mockResolvedValue({ totalReceived: 0, totalPending: 0, escrows: [] });

    const { findByPlaceholderText, findByText } = renderWithProviders(<BusinessDashboardScreen />);

    fireEvent.press(await findByText('기간 금액권'));
    expect(await findByText('실제 충전 금액')).toBeTruthy();
    fireEvent.changeText(await findByPlaceholderText('예: 90,000'), '90000');
    fireEvent.changeText(await findByPlaceholderText('예: 100,000'), '100000');
    expect((await findByPlaceholderText('예: 2026-05-13')).props.type).toBe('date');
    expect((await findByPlaceholderText('예: 2026-08-13')).props.type).toBe('date');
    expect((await findByPlaceholderText('예: 2026-05-13')).props.inputMode).toBe('none');
    expect((await findByPlaceholderText('예: 2026-08-13')).props.inputMode).toBe('none');
    fireEvent.changeText(await findByPlaceholderText('예: 2026-05-13'), '20260513');
    fireEvent.changeText(await findByPlaceholderText('예: 2026-08-13'), '20260813');
    fireEvent.press(await findByText('QR 결제 만들기'));

    await waitFor(() => {
      expect(api.createPaymentRequest).toHaveBeenCalledWith({
        businessId: 'business-1',
        paymentAmount: 66.666667,
        totalAmount: 74.074074,
        paymentModel: 'voucher',
        escrowType: 'prepaid',
        unitPrice: 7.407407,
        validityMonths: 3,
        validFrom: '2026-05-13',
        validUntil: '2026-08-13',
      });
    });
    expect(await findByText('TP-654321')).toBeTruthy();
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

    const { findAllByText, findByPlaceholderText, findByText } = renderWithProviders(<BusinessDashboardScreen />);

    expect(await findByText(/이미 보호 원장에 잠긴 이용권에서 이용분 차감 요청을 보냅니다/)).toBeTruthy();
    expect((await findAllByText('이용금액 직접 입력')).length).toBeGreaterThan(0);
    expect(await findByText('고객 이용분 승인 요청')).toBeTruthy();
    expect(await findByText(/₩6,750\/회/)).toBeTruthy();
    expect((await findAllByText('5.00 RLUSD')).length).toBeGreaterThan(0);
    fireEvent.changeText(await findByPlaceholderText('예: 67,500'), '67500');
    fireEvent.press(await findByText('입력 금액 승인 요청'));

    await waitFor(() => {
      expect(api.createChargeRequest).toHaveBeenCalledWith('e-prepaid', {
        menuName: '직접 입력 이용금액',
        amount: 50,
      });
      const { showSuccessToast } = require('../../utils/toast');
      expect(showSuccessToast).toHaveBeenCalledWith('이용분 승인 요청 전송', '소비자 승인 대기 상태로 등록되었습니다.');
    });
  });
});
