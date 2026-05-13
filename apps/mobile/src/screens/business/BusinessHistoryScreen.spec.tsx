import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessHistoryScreen } from './BusinessHistoryScreen';

jest.mock('../../api/client', () => ({
  api: {
    getBusinessDashboard: jest.fn(),
  },
}));

jest.mock('../../store/auth', () => ({
  useAuthStore: (selector: any) => selector({ userId: 'business-1', role: 'business', name: '파워짐' }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('BusinessHistoryScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should include newly approved protected payments before any settlement is released', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 600,
      escrows: [
        {
          id: 'e-qr-approved',
          status: 'active',
          escrowType: 'monthly',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-1', name: '김민수' },
          createdAt: '2026-05-13T00:00:00Z',
          entries: [
            { id: 'en-1', month: 1, amount: '100', status: 'pending', finishAfter: 830607775 },
            { id: 'en-2', month: 2, amount: '100', status: 'pending', finishAfter: 833199775 },
          ],
        },
      ],
    });

    const { findByText } = renderWithProviders(<BusinessHistoryScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText('전체 결제 내역')).toBeTruthy();
    expect(await findByText('보호 결제 시작')).toBeTruthy();
    expect(await findByText('김민수 · 월정액 6개월')).toBeTruthy();
    expect(await findByText('₩810,000')).toBeTruthy();
    expect(await findByText('600.00 RLUSD')).toBeTruthy();
  });
});
