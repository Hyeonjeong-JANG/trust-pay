import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentScreen } from './PaymentScreen';

jest.mock('../../utils/toast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../../api/client', () => ({
  api: { createEscrow: jest.fn() },
}));

jest.mock('../../store/auth', () => ({
  useAuthStore: (selector: any) => selector({ userId: 'consumer-1' }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('PaymentScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should explain the monthly Token Escrow structure', () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(
      <PaymentScreen
        navigation={{ navigate: jest.fn() } as any}
        route={{ params: { businessId: 'b-1', businessName: '파워짐 헬스장' } } as any}
      />,
    );

    fireEvent.changeText(getByPlaceholderText('예: 600'), '600');
    fireEvent.changeText(getByPlaceholderText('예: 6'), '6');

    expect(getByText('100.00 RLUSD')).toBeTruthy();
    expect(getByText(/총액은 6개의 Token Escrow로 나뉘어 잠기고/)).toBeTruthy();
  });
});
