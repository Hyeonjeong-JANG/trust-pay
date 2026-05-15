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
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ScheduleScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should show empty state when no pending entries', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);
    const { findByText } = renderWithProviders(<ScheduleScreen navigation={{} as any} route={{} as any} />);
    expect(await findByText('예정된 정산이 없습니다')).toBeTruthy();
    expect(await findByText('활성 보호 결제의 대기 월차가 생기면 정산 가능 시점 기준으로 표시됩니다')).toBeTruthy();
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
    const { findAllByText, findByText } = renderWithProviders(<ScheduleScreen navigation={{} as any} route={{} as any} />);
    expect(await findByText('테스트카페')).toBeTruthy();
    expect(await findByText('1월차')).toBeTruthy();
    expect(await findByText(/사업자가 수령할 수 있습니다/)).toBeTruthy();
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
    const { findAllByText, findByText } = renderWithProviders(<ScheduleScreen navigation={{} as any} route={{} as any} />);
    expect(await findByText('2')).toBeTruthy(); // 2건
    expect(await findByText('₩2,700,000')).toBeTruthy();
    expect(await findByText('2,000.00 RLUSD')).toBeTruthy();
    expect((await findAllByText('₩1,350,000 (1,000.00 RLUSD)')).length).toBeGreaterThan(0);
  });

  it('should summarize prepaid vouchers as balance instead of remaining counts', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([{
      id: 'e-prepaid', status: 'active', escrowType: 'prepaid', totalAmount: 150, monthlyAmount: 5, months: 30, validityMonths: 3,
      business: { name: '강남 블루보틀' },
      entries: [
        ...Array.from({ length: 8 }, (_, index) => ({ id: `r-${index}`, month: index + 1, amount: '5', status: 'released', cancelAfter: 837000000 })),
        ...Array.from({ length: 22 }, (_, index) => ({ id: `p-${index}`, month: index + 9, amount: '5', status: 'pending', finishAfter: 830607775, cancelAfter: 837000000 })),
      ],
    }]);

    const { findByText, queryByText } = renderWithProviders(<ScheduleScreen navigation={{} as any} route={{} as any} />);

    expect(await findByText('금액권 잔액')).toBeTruthy();
    expect(await findByText(/강남 블루보틀/)).toBeTruthy();
    expect(await findByText(/잔액 ₩148,500/)).toBeTruthy();
    expect(queryByText(/회 남음/)).toBeNull();
    expect(queryByText(/만료:/)).toBeNull();
    expect(queryByText('9회차')).toBeNull();
  });
});
