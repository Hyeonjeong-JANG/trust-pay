import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScheduleScreen } from './ScheduleScreen';

jest.mock('../../api/client', () => ({
  api: {
    getConsumerEscrows: jest.fn(),
  },
}));

jest.mock('../../store/auth', () => ({
  useAuthStore: (selector: any) =>
    selector({ role: 'consumer', userId: 'c-1', name: '테스트' }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ScheduleScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should show empty state when no pending entries', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);
    const { findByText } = renderWithProviders(<ScheduleScreen navigation={{} as any} route={{} as any} />);
    expect(await findByText('예정된 릴리즈가 없습니다')).toBeTruthy();
  });

  it('should show schedule items for active escrows', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([{
      id: 'e-1', status: 'active', totalAmount: 3000, monthlyAmount: 1000, months: 3,
      business: { name: '테스트카페' },
      entries: [
        { id: 'en-1', month: 1, amount: '1000', status: 'pending', finishAfter: 830607775 },
        { id: 'en-2', month: 2, amount: '1000', status: 'released', finishAfter: 830607895 },
      ],
    }]);
    const { findByText } = renderWithProviders(<ScheduleScreen navigation={{} as any} route={{} as any} />);
    expect(await findByText('테스트카페')).toBeTruthy();
    expect(await findByText('1월차')).toBeTruthy();
  });

  it('should show summary with total pending count and amount', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([{
      id: 'e-1', status: 'active', totalAmount: 2000, monthlyAmount: 1000, months: 2,
      business: { name: '카페' },
      entries: [
        { id: 'en-1', month: 1, amount: '1000', status: 'pending', finishAfter: 830607775 },
        { id: 'en-2', month: 2, amount: '1000', status: 'pending', finishAfter: 830607895 },
      ],
    }]);
    const { findByText } = renderWithProviders(<ScheduleScreen navigation={{} as any} route={{} as any} />);
    expect(await findByText('2')).toBeTruthy(); // 2건
    expect(await findByText('2,000')).toBeTruthy(); // 2000 RLUSD
  });
});
