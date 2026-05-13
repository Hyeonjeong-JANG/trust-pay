import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScanPaymentScreen } from './ScanPaymentScreen';

jest.mock('../../api/client', () => ({
  api: {
    getPaymentRequest: jest.fn(),
  },
}));

jest.mock('../../utils/toast', () => ({
  showErrorToast: jest.fn(),
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

describe('ScanPaymentScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should resolve a merchant QR code and navigate to account approval payment', async () => {
    const { api } = require('../../api/client');
    const navigate = jest.fn();
    api.getPaymentRequest.mockResolvedValue({
      id: 'request-1',
      code: 'TP-123456',
      businessId: 'business-1',
      businessName: '파워짐 피트니스',
      businessCategory: '헬스장',
      totalAmount: 600,
      months: 6,
      escrowType: 'monthly',
      status: 'pending',
      createdAt: '2026-05-13T00:00:00Z',
    });

    const { findByPlaceholderText, findByText } = renderWithProviders(
      <ScanPaymentScreen navigation={{ navigate } as any} route={{} as any} />,
    );

    expect(await findByText('사업자 QR 스캔')).toBeTruthy();
    expect(await findByText('사업자 화면에 표시된 TP-xxxxxx 코드를 입력하세요.')).toBeTruthy();
    fireEvent.changeText(await findByPlaceholderText('예: TP-123456'), 'tp-123456');
    fireEvent.press(await findByText('결제 QR 불러오기'));

    await waitFor(() => {
      expect(api.getPaymentRequest).toHaveBeenCalledWith('TP-123456');
      expect(navigate).toHaveBeenCalledWith('Payment', {
        businessId: 'business-1',
        businessName: '파워짐 피트니스',
        businessCategory: '헬스장',
        paymentRequest: expect.objectContaining({ code: 'TP-123456', totalAmount: 600 }),
      });
    });
  });
});
