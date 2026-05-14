import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HistoryScreen } from './HistoryScreen';

jest.mock('../../api/client', () => ({
  api: { getConsumerEscrows: jest.fn() },
}));

jest.mock('../../store/auth', () => ({
  useAuthStore: (selector: any) => selector({ role: 'consumer', userId: 'consumer-1', name: '김민수' }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('HistoryScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should label created escrows as protected account-approved payments', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([
      {
        id: 'e-1',
        totalAmount: 600,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        business: { name: '파워짐 헬스장' },
        entries: [],
      },
    ]);

    const { findByText, queryByText } = renderWithProviders(
      <HistoryScreen navigation={{} as any} route={{} as any} />,
    );

    expect(await findByText('보호 결제 시작')).toBeTruthy();
    expect(await findByText('파워짐 헬스장')).toBeTruthy();
    expect(queryByText('에스크로 생성')).toBeNull();
  });

  it('should include refund review requests in the consumer history timeline', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([
      {
        id: 'e-refund-review',
        totalAmount: 150,
        status: 'active',
        createdAt: '2026-05-13T00:00:00.000Z',
        business: { name: '강남 블루보틀' },
        entries: [],
        refundReviewRequests: [
          {
            id: 'refund-review-1',
            status: 'platform_review',
            refundableAmount: 10,
            requestedAt: '2026-05-14T00:00:00.000Z',
          },
        ],
      },
    ]);

    const { findAllByText, findByText } = renderWithProviders(
      <HistoryScreen navigation={{} as any} route={{} as any} />,
    );

    expect(await findByText('환불 검토 요청 접수')).toBeTruthy();
    expect((await findAllByText('강남 블루보틀')).length).toBeGreaterThan(0);
  });
});
