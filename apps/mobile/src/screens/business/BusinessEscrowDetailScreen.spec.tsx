import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessEscrowDetailScreen } from './BusinessEscrowDetailScreen';

jest.mock('../../api/client', () => ({
  api: {
    getEscrow: jest.fn(),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function isoDateToRippleTime(value: string) {
  const rippleEpoch = 946684800;
  return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 1000) - rippleEpoch;
}

describe('BusinessEscrowDetailScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should show merchant-facing monthly escrow details for the selected customer', async () => {
    const { api } = require('../../api/client');
    api.getEscrow.mockResolvedValue({
      id: 'e-monthly-business',
      status: 'active',
      escrowType: 'monthly',
      totalAmount: 600,
      monthlyAmount: 100,
      months: 6,
      business: { name: '파워짐 피트니스' },
      consumer: { name: '김민수' },
      entries: [
        { id: 'en-1', month: 1, amount: '100', status: 'released', finishAfter: isoDateToRippleTime('2026-05-13'), cancelAfter: isoDateToRippleTime('2026-06-13'), txHash: 'MONTH_1_TX' },
        { id: 'en-2', month: 2, amount: '100', status: 'pending', finishAfter: isoDateToRippleTime('2026-06-13'), cancelAfter: isoDateToRippleTime('2026-07-13') },
      ],
    });

    const { findByText } = renderWithProviders(
      <BusinessEscrowDetailScreen route={{ params: { id: 'e-monthly-business' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('사업자 결제 상세')).toBeTruthy();
    expect(await findByText('고객 김민수')).toBeTruthy();
    expect(await findByText('₩810,000')).toBeTruthy();
    expect(await findByText(/이용기간 2026\. 5\. 13\. ~ 2026\. 7\. 13\./)).toBeTruthy();
    expect(await findByText('1월차 정산 완료')).toBeTruthy();
    expect(await findByText(/원장 증빙: MONTH_1_TX/)).toBeTruthy();
  });

  it('should show prepaid validity and usage units for the merchant', async () => {
    const { api } = require('../../api/client');
    api.getEscrow.mockResolvedValue({
      id: 'e-prepaid-business',
      status: 'active',
      escrowType: 'prepaid',
      totalAmount: 74.074074,
      monthlyAmount: 7.407407,
      unitPrice: 7.407407,
      months: 10,
      validityMonths: 3,
      validFrom: '2026-05-13',
      validUntil: '2026-08-13',
      business: { name: '강남 블루보틀' },
      consumer: { name: '이서연' },
      entries: [
        { id: 'en-1', month: 1, amount: '7.407407', status: 'pending', finishAfter: 830607775, cancelAfter: 837000000 },
      ],
    });

    const { findByText } = renderWithProviders(
      <BusinessEscrowDetailScreen route={{ params: { id: 'e-prepaid-business' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('고객 이서연')).toBeTruthy();
    expect(await findByText(/사용기한 2026\. 5\. 13\. ~ 2026\. 8\. 13\./)).toBeTruthy();
    expect(await findByText('이용 단위 내역')).toBeTruthy();
    expect(await findByText('이용 단위 1')).toBeTruthy();
  });
});
