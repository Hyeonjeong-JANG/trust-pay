import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EscrowDetailScreen } from './EscrowDetailScreen';

jest.mock('../../utils/toast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../../api/client', () => ({
  api: {
    getEscrow: jest.fn(),
    cancelEscrow: jest.fn(),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('EscrowDetailScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should show ledger status and transaction evidence', async () => {
    const { api } = require('../../api/client');
    api.getEscrow.mockResolvedValue({
      id: 'e-1',
      status: 'active',
      totalAmount: 600,
      monthlyAmount: 100,
      months: 6,
      business: { name: '파워짐 헬스장' },
      entries: [
        { id: 'en-1', month: 1, amount: '100', status: 'released', finishAfter: 830607775, txHash: 'ABC123' },
        { id: 'en-2', month: 2, amount: '100', status: 'pending', finishAfter: 830607895 },
      ],
    });

    const { findByText } = renderWithProviders(
      <EscrowDetailScreen route={{ params: { id: 'e-1' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('XRPL 원장 상태')).toBeTruthy();
    expect(await findByText('릴리즈 완료 1건 · 대기/환불 가능 1건')).toBeTruthy();
    expect(await findByText(/TX Hash: ABC123/)).toBeTruthy();
  });
});
