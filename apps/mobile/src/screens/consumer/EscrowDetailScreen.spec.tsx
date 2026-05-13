import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
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
    approveChargeRequest: jest.fn(),
    rejectChargeRequest: jest.fn(),
  },
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
        { id: 'en-2', month: 2, amount: '100', status: 'released', finishAfter: 830607895 },
        { id: 'en-3', month: 3, amount: '100', status: 'released', finishAfter: 830607995 },
        { id: 'en-4', month: 4, amount: '100', status: 'pending', finishAfter: 830608095 },
        { id: 'en-5', month: 5, amount: '100', status: 'pending', finishAfter: 830608195 },
        { id: 'en-6', month: 6, amount: '100', status: 'pending', finishAfter: 830608295 },
      ],
    });

    const { findByText, findAllByText, queryByText } = renderWithProviders(
      <EscrowDetailScreen route={{ params: { id: 'e-1' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('XRPL 원장 상태')).toBeTruthy();
    expect(await findByText('₩810,000')).toBeTruthy();
    expect(await findByText('600.00 RLUSD')).toBeTruthy();
    expect(await findByText('3개월 정산 완료 · 3개월 예정')).toBeTruthy();
    expect((await findAllByText(/정산 가능일:/)).length).toBeGreaterThan(0);
    expect(await findByText(/원장 증빙: ABC123/)).toBeTruthy();
    expect(queryByText(/finishAfter:/)).toBeNull();
  });

  it('should show prepaid ledger units with date-range usage period when there is no charge history', async () => {
    const { api } = require('../../api/client');
    api.getEscrow.mockResolvedValue({
      id: 'e-prepaid',
      status: 'active',
      escrowType: 'prepaid',
      totalAmount: 150,
      monthlyAmount: 5,
      months: 30,
      unitPrice: 5,
      validityMonths: 3,
      business: { name: '강남 블루보틀' },
      entries: [
        { id: 'en-1', month: 1, amount: '5', status: 'released', finishAfter: 830607775, cancelAfter: 837000000, txHash: 'PREPAID1' },
        { id: 'en-2', month: 2, amount: '5', status: 'pending', finishAfter: 830607775, cancelAfter: 837000000 },
      ],
    });

    const { findByText, findAllByText } = renderWithProviders(
      <EscrowDetailScreen route={{ params: { id: 'e-prepaid' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('보호단위')).toBeTruthy();
    expect(await findByText(/사용기한 2026\. 4\. 27\. ~ 2026\. 7\. 10\./)).toBeTruthy();
    expect(await findByText('원장 보호 단위')).toBeTruthy();
    expect(await findByText('보호 단위 1')).toBeTruthy();
    expect(await findAllByText(/만료:/)).toHaveLength(2);
  });

  it('should show prepaid menu charge history instead of raw same-priced entry rounds', async () => {
    const { api } = require('../../api/client');
    api.getEscrow.mockResolvedValue({
      id: 'e-cafe-completed',
      status: 'completed',
      escrowType: 'prepaid',
      totalAmount: 150,
      monthlyAmount: 5,
      months: 30,
      unitPrice: 5,
      validityMonths: 3,
      business: { name: '강남 블루보틀' },
      entries: [
        { id: 'en-1', month: 1, amount: '5', status: 'released', finishAfter: 830607775, cancelAfter: 837000000, txHash: 'TX_UNIT_1' },
        { id: 'en-2', month: 2, amount: '5', status: 'released', finishAfter: 830607775, cancelAfter: 837000000, txHash: 'TX_UNIT_2' },
        { id: 'en-3', month: 3, amount: '5', status: 'released', finishAfter: 830607775, cancelAfter: 837000000, txHash: 'TX_UNIT_3' },
        { id: 'en-4', month: 4, amount: '5', status: 'released', finishAfter: 830607775, cancelAfter: 837000000, txHash: 'TX_UNIT_4' },
      ],
      chargeRequests: [
        {
          id: 'charge-americano',
          menuName: '아메리카노',
          amount: 5,
          status: 'settled',
          entryIds: JSON.stringify(['en-1']),
          requestedAt: '2026-05-02T02:00:00Z',
          approvedAt: '2026-05-02T02:03:00Z',
          settledAt: '2026-05-02T02:05:00Z',
          txHash: 'TX_AMERICANO',
        },
        {
          id: 'charge-brunch',
          menuName: '브런치 세트',
          amount: 15,
          status: 'settled',
          entryIds: JSON.stringify(['en-2', 'en-3', 'en-4']),
          requestedAt: '2026-05-03T02:00:00Z',
          approvedAt: '2026-05-03T02:03:00Z',
          settledAt: '2026-05-03T02:05:00Z',
          txHash: 'TX_BRUNCH',
        },
      ],
    });

    const { findAllByText, findByText, queryByText } = renderWithProviders(
      <EscrowDetailScreen route={{ params: { id: 'e-cafe-completed' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('차감 내역')).toBeTruthy();
    expect(await findByText('사용 완료 4/4단위 · 잔여 0단위 · 차감 2건')).toBeTruthy();
    expect(await findByText('아메리카노 ₩6,750')).toBeTruthy();
    expect(await findByText('브런치 세트 ₩20,250')).toBeTruthy();
    expect((await findAllByText('5.00 RLUSD')).length).toBeGreaterThan(0);
    expect((await findAllByText('15.00 RLUSD')).length).toBeGreaterThan(0);
    expect(await findByText(/사용기한 2026\. 4\. 27\. ~ 2026\. 7\. 10\./)).toBeTruthy();
    expect(await findByText(/원장 증빙: TX_AMERICANO/)).toBeTruthy();
    expect(queryByText('1회차')).toBeNull();
    expect(queryByText('150 RLUSD')).toBeNull();
  });

  it('should lead cancelled prepaid details with refund summary before ledger units', async () => {
    const { api } = require('../../api/client');
    api.getEscrow.mockResolvedValue({
      id: 'e-cancelled-prepaid',
      status: 'cancelled',
      escrowType: 'prepaid',
      totalAmount: 400,
      monthlyAmount: 100,
      months: 4,
      unitPrice: 100,
      validityMonths: 4,
      business: { name: '헤어살롱 루나' },
      entries: [
        { id: 'en-1', month: 1, amount: '100', status: 'released', finishAfter: 830607775, cancelAfter: 837000000, txHash: 'USED_UNIT' },
        { id: 'en-2', month: 2, amount: '100', status: 'refunded', finishAfter: 830607775, cancelAfter: 837000000, txHash: 'REFUND_2' },
        { id: 'en-3', month: 3, amount: '100', status: 'refunded', finishAfter: 830607775, cancelAfter: 837000000, txHash: 'REFUND_3' },
        { id: 'en-4', month: 4, amount: '100', status: 'refunded', finishAfter: 830607775, cancelAfter: 837000000, txHash: 'REFUND_4' },
      ],
    });

    const { findByText, queryByText } = renderWithProviders(
      <EscrowDetailScreen route={{ params: { id: 'e-cancelled-prepaid' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('취소/환불 요약')).toBeTruthy();
    expect(await findByText('사용 ₩135,000')).toBeTruthy();
    expect(await findByText('환불 ₩405,000')).toBeTruthy();
    expect(await findByText('환불 완료 3개 단위')).toBeTruthy();
    expect(await findByText('XRPL 원장 상세')).toBeTruthy();
    expect(await findByText(/원장 증빙: USED_UNIT/)).toBeTruthy();
    expect(queryByText('원장 보호 단위')).toBeNull();
  });

  it('should let the consumer approve a pending menu charge request', async () => {
    const { api } = require('../../api/client');
    api.getEscrow.mockResolvedValue({
      id: 'e-prepaid',
      status: 'active',
      escrowType: 'prepaid',
      totalAmount: 300,
      monthlyAmount: 10,
      months: 30,
      unitPrice: 10,
      validityMonths: 6,
      business: { name: '헤어살롱 루나' },
      entries: [
        { id: 'en-1', month: 1, amount: '10', status: 'pending', finishAfter: 830607775, cancelAfter: 837000000 },
      ],
      chargeRequests: [
        {
          id: 'charge-1',
          menuName: '클리닉',
          amount: 50,
          status: 'pending_approval',
          entryIds: JSON.stringify(['en-1']),
          requestedAt: '2026-05-12T10:00:00Z',
        },
      ],
    });
    api.approveChargeRequest.mockResolvedValue({ id: 'charge-1', status: 'settled' });

    const { findByText } = renderWithProviders(
      <EscrowDetailScreen route={{ params: { id: 'e-prepaid' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('승인 대기 차감 요청')).toBeTruthy();
    expect(await findByText('클리닉 ₩67,500')).toBeTruthy();
    expect(await findByText('50.00 RLUSD')).toBeTruthy();
    fireEvent.press(await findByText('승인하고 정산'));

    await waitFor(() => {
      expect(api.approveChargeRequest).toHaveBeenCalledWith('charge-1');
    });
  });

  it('should request refund review without directly cancelling escrow entries', async () => {
    const { api } = require('../../api/client');
    const { showSuccessToast } = require('../../utils/toast');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    api.getEscrow.mockResolvedValue({
      id: 'e-prepaid-refund',
      status: 'active',
      escrowType: 'prepaid',
      totalAmount: 300,
      monthlyAmount: 10,
      months: 30,
      unitPrice: 10,
      validityMonths: 6,
      business: { name: '헤어살롱 루나' },
      entries: [
        { id: 'en-1', month: 1, amount: '10', status: 'released', finishAfter: 830607775, cancelAfter: 837000000 },
        { id: 'en-2', month: 2, amount: '10', status: 'pending', finishAfter: 830607775, cancelAfter: 837000000 },
      ],
      chargeRequests: [],
    });

    const { findByText } = renderWithProviders(
      <EscrowDetailScreen route={{ params: { id: 'e-prepaid-refund' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('환불 검토 요청')).toBeTruthy();
    expect(await findByText(/실제 결제액, 보너스 혜택, 사용분 공제 후 환불 가능 금액을 산정합니다/)).toBeTruthy();
    fireEvent.press(await findByText('환불 검토 요청'));

    expect(alertSpy).toHaveBeenCalledWith(
      '환불 검토 요청',
      expect.stringContaining('즉시 에스크로를 취소하지 않습니다'),
      expect.any(Array),
    );
    const actions = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    actions[1].onPress?.();

    expect(api.cancelEscrow).not.toHaveBeenCalled();
    expect(showSuccessToast).toHaveBeenCalledWith('환불 검토 요청 접수', '약관과 사용 내역을 확인한 뒤 환불 가능 금액을 안내합니다.');
    alertSpy.mockRestore();
  });
});
