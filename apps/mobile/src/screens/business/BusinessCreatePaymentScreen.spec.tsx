import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessCreatePaymentScreen } from './BusinessCreatePaymentScreen';

jest.mock('../../utils/toast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../../api/client', () => ({
  api: {
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

describe('BusinessCreatePaymentScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return to the merchant dashboard from the QR creation task screen', async () => {
    const navigation = { navigate: jest.fn() };
    const { findByText } = renderWithProviders(
      <BusinessCreatePaymentScreen route={{} as any} navigation={navigation as any} />,
    );

    fireEvent.press(await findByText('뒤로'));

    expect(navigation.navigate).toHaveBeenCalledWith('Dashboard');
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

    const { findByPlaceholderText, findByText, queryByText, queryByPlaceholderText } = renderWithProviders(
      <BusinessCreatePaymentScreen route={{} as any} navigation={{} as any} />,
    );

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

    const { findByPlaceholderText, findByText, getByLabelText } = renderWithProviders(
      <BusinessCreatePaymentScreen route={{} as any} navigation={{} as any} />,
    );

    fireEvent.press(await findByText('기간 금액권'));
    expect(await findByText('실제 충전 금액')).toBeTruthy();
    fireEvent.changeText(await findByPlaceholderText('예: 90,000'), '90000');
    fireEvent.changeText(await findByPlaceholderText('예: 100,000'), '100000');
    expect(getByLabelText('사용 시작일 선택').props.accessibilityRole).toBe('button');
    expect(getByLabelText('사용 종료일 선택').props.accessibilityRole).toBe('button');
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
});
