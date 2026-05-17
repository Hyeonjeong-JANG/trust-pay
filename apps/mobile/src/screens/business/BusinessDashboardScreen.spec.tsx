import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessDashboardScreen } from './BusinessDashboardScreen';

jest.mock('../../utils/toast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../../api/client', () => ({
  api: {
    getBusinessDashboard: jest.fn(),
    getBalance: jest.fn().mockResolvedValue({ xrplAddress: 'rBusiness123456', balance: '1200' }),
    finishEscrow: jest.fn(),
    cancelPaymentRequest: jest.fn(),
    createChargeRequest: jest.fn(),
    getBusinessProducts: jest.fn(),
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

function flattenText(value: unknown): string {
  if (Array.isArray(value)) return value.map(flattenText).join('');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

describe('BusinessDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { api } = require('../../api/client');
    api.getBusinessProducts.mockResolvedValue([]);
    api.finishEscrow.mockResolvedValue({ txHash: 'AUTO_FINISH_TX' });
    api.cancelPaymentRequest.mockResolvedValue({ id: 'request-1', status: 'cancelled' });
  });

  it('should periodically refresh the dashboard so merchant screens reflect customer approvals', async () => {
    jest.useFakeTimers();
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 0,
      escrows: [],
    });

    try {
      const { findByText, queryByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

      expect(await findByText('진행중 보호 결제 (0건)')).toBeTruthy();
      expect(queryByText('QR 결제 만들기')).toBeNull();
      expect(queryByText('결제 금액')).toBeNull();
      expect(api.getBusinessDashboard).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => expect(api.getBusinessDashboard).toHaveBeenCalledTimes(2));
    } finally {
      jest.useRealTimers();
    }
  });

  it('should pause dashboard polling while the app is backgrounded', async () => {
    jest.useFakeTimers();
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 0,
      escrows: [],
    });

    try {
      renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

      await waitFor(() => expect(api.getBusinessDashboard).toHaveBeenCalledTimes(1));

      act(() => {
        focusManager.setFocused(false);
      });
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });

      expect(api.getBusinessDashboard).toHaveBeenCalledTimes(1);
    } finally {
      focusManager.setFocused(undefined);
      jest.useRealTimers();
    }
  });

  it('should show merchant-created payment requests as pending customer approvals', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 0,
      escrows: [],
      pendingPaymentRequests: [
        {
          id: 'request-1',
          code: 'TP-000001',
          businessId: 'business-1',
          businessName: '파워짐',
          paymentAmount: 222.222222,
          totalAmount: 244.444444,
          paymentModel: 'voucher',
          escrowType: 'prepaid',
          validFrom: '2026-05-15',
          validUntil: '2026-07-22',
          status: 'pending',
          createdAt: '2026-05-15T00:00:00.000Z',
        },
      ],
    });

    const { findAllByText, findByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect((await findAllByText('승인 대기 QR')).length).toBeGreaterThan(0);
    expect(await findByText('TP-000001')).toBeTruthy();
    expect(await findByText('손님 승인 전')).toBeTruthy();
    expect(await findByText('결제 ₩300,000 · 보호 ₩330,000')).toBeTruthy();
    expect(await findByText('진행중 보호 결제 (0건)')).toBeTruthy();
  });

  it('should show server-side settlement state without finishing escrows from the screen', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 300,
      totalPending: 300,
      summary: {
        receivedAmount: 300,
        protectedPendingAmount: 300,
        pendingApprovalAmount: 0,
        activeEscrowCount: 1,
        refundActionRequiredCount: 0,
        refundMonitoringCount: 0,
        refundCompletedCount: 0,
        dueSettlementCount: 1,
        dueSettlementAmount: 100,
      },
      escrows: [
        {
          id: 'e-1',
          status: 'active',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-1', name: '김민수' },
          entries: [
            { id: 'en-1', month: 1, amount: '100', status: 'pending', finishAfter: 830607775 },
          ],
        },
      ],
    });

    const { findAllByText, findByText, queryByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText('오늘 처리할 일')).toBeTruthy();
    expect(await findByText('이번 달 정산 예정')).toBeTruthy();
    expect((await findAllByText('1건')).length).toBeGreaterThan(0);
    expect(await findByText('수령 가능 ₩1,620,000')).toBeTruthy();
    expect(await findByText('수령 완료')).toBeTruthy();
    expect(await findByText('보호 대기')).toBeTruthy();
    expect(await findByText('승인 대기')).toBeTruthy();
    expect((await findAllByText('100.00 RLUSD')).length).toBeGreaterThan(0);
    expect(await findByText('1,200.00 RLUSD')).toBeTruthy();
    expect(queryByText('1월차 수령 가능 (₩135,000)')).toBeNull();
    expect(api.finishEscrow).not.toHaveBeenCalled();
  });

  it('should not auto-finish monthly settlements while a refund review is open', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 300,
      totalPending: 300,
      escrows: [
        {
          id: 'e-disputed',
          status: 'active',
          escrowType: 'monthly',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-1', name: '김민수' },
          refundReviewRequests: [{ id: 'review-1', status: 'merchant_review' }],
          entries: [
            { id: 'en-1', month: 1, amount: '100', status: 'pending', finishAfter: 830607775 },
          ],
        },
      ],
    });

    const { findByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText('김민수')).toBeTruthy();
    expect(api.finishEscrow).not.toHaveBeenCalled();
  });

  it('should open business escrow detail from an escrow card', async () => {
    const { api } = require('../../api/client');
    const navigation = { navigate: jest.fn() };
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 600,
      escrows: [
        {
          id: 'e-detail',
          status: 'active',
          escrowType: 'monthly',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-1', name: '김민수' },
          entries: [
            { id: 'en-1', month: 1, amount: '100', status: 'pending', finishAfter: 830607775 },
          ],
        },
      ],
    });

    const { findByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={navigation as any} />);

    fireEvent.press(await findByText('김민수'));

    expect(navigation.navigate).toHaveBeenCalledWith('BusinessEscrowDetail', { id: 'e-detail' });
  });

  it('should default to the active escrow filter when a merchant opens the dashboard', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 600,
      totalPending: 600,
      escrows: [
        {
          id: 'e-active',
          status: 'active',
          escrowType: 'monthly',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-active', name: '김민수' },
          entries: [
            { id: 'en-active', month: 1, amount: '100', status: 'pending', finishAfter: 830607775 },
          ],
        },
        {
          id: 'e-completed',
          status: 'completed',
          escrowType: 'monthly',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-completed', name: '완료 고객' },
          entries: [
            { id: 'en-completed', month: 1, amount: '100', status: 'released', finishAfter: 830607775 },
          ],
        },
      ],
    });

    const { findByText, queryByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText('진행중 보호 결제 (1건)')).toBeTruthy();
    expect(await findByText('김민수')).toBeTruthy();
    expect(queryByText('완료 고객')).toBeNull();
  });

  it('should show the newest approved escrow first on the merchant dashboard', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 1200,
      escrows: [
        {
          id: 'e-older',
          status: 'active',
          escrowType: 'monthly',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-old', name: '기존 고객' },
          entries: [{ id: 'en-old', month: 1, amount: '100', status: 'pending', finishAfter: 830607775 }],
          createdAt: '2026-05-13T00:00:00.000Z',
          updatedAt: '2026-05-13T00:00:00.000Z',
        },
        {
          id: 'e-newer',
          status: 'active',
          escrowType: 'monthly',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-new', name: '신규 고객' },
          entries: [{ id: 'en-new', month: 1, amount: '100', status: 'released', finishAfter: 830607775 }],
          createdAt: '2026-05-17T00:00:00.000Z',
          updatedAt: '2026-05-17T00:00:00.000Z',
        },
      ],
    });

    const { findByText, UNSAFE_getAllByType } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText('수령 가능 ₩1,620,000')).toBeTruthy();
    expect(await findByText('신규 고객')).toBeTruthy();
    expect(await findByText('기존 고객')).toBeTruthy();
    const texts = UNSAFE_getAllByType(Text).map((node) => flattenText(node.props.children));
    expect(texts.indexOf('신규 고객')).toBeLessThan(texts.indexOf('기존 고객'));
  });

  it('should keep prepaid charge controls out of dashboard cards', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 25,
      totalPending: 125,
      escrows: [
        {
          id: 'e-prepaid',
          status: 'active',
          escrowType: 'prepaid',
          totalAmount: 150,
          monthlyAmount: 5,
          months: 30,
          unitPrice: 5,
          validityMonths: 3,
          product: {
            id: 'product-cafe',
            menuItems: [
              { id: 'menu-americano', name: '아메리카노', amount: 5 },
              { id: 'menu-brunch', name: '브런치 세트', amount: 15 },
            ],
          },
          consumer: { id: 'consumer-2', name: '이서연' },
          entries: [
            { id: 'en-1', month: 9, amount: '5', status: 'pending', finishAfter: 830607775 },
            { id: 'en-2', month: 10, amount: '5', status: 'pending', finishAfter: 830607775 },
            { id: 'en-3', month: 11, amount: '5', status: 'pending', finishAfter: 830607775 },
          ],
          chargeRequests: [
            { id: 'charge-1', menuName: '아메리카노', amount: 10, status: 'settled' },
            { id: 'charge-2', menuName: '브런치 세트', amount: 15, status: 'settled' },
          ],
        },
      ],
    });

    const { findByText, queryByText, queryByPlaceholderText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText(/금액권은 손님 승인 후 실제 이용분만 보호 잔액에서 정산됩니다/)).toBeTruthy();
    expect(await findByText('사용 ₩33,750 · 잔액 ₩168,750')).toBeTruthy();
    expect(await findByText('25.00 RLUSD 사용 · 125.00 RLUSD 잔액')).toBeTruthy();
    expect(queryByText(/\/회/)).toBeNull();
    expect(queryByText(/건 대기/)).toBeNull();
    expect(queryByText('차감 메뉴 등록')).toBeNull();
    expect(queryByText('차감 항목 선택')).toBeNull();
    expect(queryByText('직접 입력')).toBeNull();
    expect(queryByText('이용금액 직접 입력')).toBeNull();
    expect(queryByText('고객 이용분 승인 요청')).toBeNull();
    expect(queryByPlaceholderText('예: 수건 대여')).toBeNull();
    expect(queryByPlaceholderText('예: 67,500')).toBeNull();
  });

  it('should surface admin-requested refund review responses on the merchant dashboard', async () => {
    const { api } = require('../../api/client');
    const navigation = { navigate: jest.fn() };
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 25,
      totalPending: 125,
      escrows: [
        {
          id: 'e-refund',
          status: 'active',
          escrowType: 'prepaid',
          totalAmount: 150,
          monthlyAmount: 5,
          months: 30,
          consumer: { id: 'consumer-2', name: '이서연' },
          entries: [
            { id: 'en-1', month: 1, amount: '5', status: 'pending', finishAfter: 830607775 },
          ],
          chargeRequests: [],
          refundReviewRequests: [
            {
              id: 'refund-review-1',
              status: 'merchant_response_requested',
              refundableAmount: 10,
              merchantNotice: '고객이 장기 휴업을 주장했습니다. 영업 가능 여부와 이용권 처리 방안을 답변해주세요.',
              requestedAt: new Date().toISOString(),
            },
          ],
        },
      ],
    });

    const { findAllByText, findByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={navigation as any} />);

    expect((await findAllByText('환불 답변 필요')).length).toBeGreaterThan(0);
    expect((await findAllByText('1건')).length).toBeGreaterThan(0);
    expect(await findByText(/이서연 · 환불 가능 ₩13,500/)).toBeTruthy();
    expect(await findByText(/고객이 장기 휴업을 주장했습니다/)).toBeTruthy();
    fireEvent.press(await findByText('요청 확인'));
    expect(navigation.navigate).toHaveBeenCalledWith('BusinessEscrowDetail', { id: 'e-refund' });
  });

  it('should surface platform-review refund status on the merchant dashboard without consumer evidence', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 25,
      totalPending: 125,
      escrows: [
        {
          id: 'e-platform-review',
          status: 'active',
          escrowType: 'prepaid',
          totalAmount: 150,
          monthlyAmount: 5,
          months: 30,
          consumer: { id: 'consumer-2', name: '이서연' },
          entries: [],
          chargeRequests: [],
          refundReviewRequests: [
            {
              id: 'refund-review-platform',
              status: 'platform_review',
              refundableAmount: 10,
              consumerReason: '2주 넘게 안 열고 전화도 받지 않아 환불 검토를 요청합니다.',
              requestedAt: new Date().toISOString(),
            },
          ],
        },
      ],
    });

    const { findByText, queryByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText('이서연')).toBeTruthy();
    expect(await findByText(/TrustPay 확인 중인 환불 검토 1건/)).toBeTruthy();
    expect(await findByText(/환불 검토 중:/)).toBeTruthy();
    expect(queryByText(/2주 넘게 안 열고 전화도 받지 않아/)).toBeNull();
  });

  it('should surface merchant-review refund status on merchant escrow list cards', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 25,
      totalPending: 125,
      escrows: [
        {
          id: 'e-merchant-review',
          status: 'active',
          escrowType: 'prepaid',
          totalAmount: 150,
          monthlyAmount: 5,
          months: 30,
          consumer: { id: 'consumer-2', name: '김민수' },
          entries: [],
          chargeRequests: [],
          refundReviewRequests: [
            {
              id: 'refund-review-merchant',
              status: 'platform_investigation',
              refundableAmount: 10,
              consumerReason: '2주 넘게 문을 열지 않아 환불 검토를 요청합니다.',
              requestedAt: new Date().toISOString(),
            },
          ],
        },
      ],
    });

    const { findByText, queryByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText('김민수')).toBeTruthy();
    expect(await findByText('환불 검토 중: TrustPay 추가 확인 중')).toBeTruthy();
    expect(queryByText(/2주 넘게 문을 열지 않아/)).toBeNull();
  });

  it('should not expose monthly auto-settlement copy inside each dashboard card', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 600,
      escrows: [
        {
          id: 'e-monthly-copy',
          status: 'active',
          escrowType: 'monthly',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-1', name: '김민수' },
          entries: [
            { id: 'en-1', month: 1, amount: '100', status: 'pending', finishAfter: 830607775 },
          ],
        },
      ],
    });

    const { findByText, queryByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect(await findByText('김민수')).toBeTruthy();
    expect(queryByText('조건 충족 월차는 사업자 조작 없이 자동 수령됩니다.')).toBeNull();
  });

  it('should count only action-required refund reviews as pending merchant work', async () => {
    const { api } = require('../../api/client');
    const navigation = { navigate: jest.fn() };
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 25,
      totalPending: 125,
      summary: {
        receivedAmount: 25,
        protectedPendingAmount: 125,
        pendingApprovalAmount: 0,
        activeEscrowCount: 2,
        refundActionRequiredCount: 1,
        refundMonitoringCount: 0,
        refundCompletedCount: 1,
        dueSettlementCount: 0,
        dueSettlementAmount: 0,
      },
      escrows: [
        {
          id: 'e-needs-response',
          status: 'active',
          escrowType: 'prepaid',
          totalAmount: 100,
          monthlyAmount: 10,
          months: 10,
          consumer: { id: 'consumer-1', name: '김민수' },
          entries: [],
          chargeRequests: [],
          refundReviewRequests: [
            {
              id: 'review-open',
              status: 'merchant_response_requested',
              refundableAmount: 40,
              merchantNotice: '이용권 처리 방안을 답변해주세요.',
              requestedAt: '2026-05-15T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'e-refunded',
          status: 'cancelled',
          escrowType: 'prepaid',
          totalAmount: 100,
          monthlyAmount: 10,
          months: 10,
          consumer: { id: 'consumer-2', name: '이서연' },
          entries: [],
          chargeRequests: [],
          refundReviewRequests: [
            {
              id: 'review-done',
              status: 'refunded',
              refundableAmount: 10,
              requestedAt: '2026-05-14T00:00:00.000Z',
            },
          ],
        },
      ],
    });

    const { findAllByLabelText, findAllByText, queryByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={navigation as any} />);

    expect((await findAllByText('환불 답변 필요')).length).toBeGreaterThan(0);
    expect((await findAllByText('1건')).length).toBeGreaterThan(0);
    expect(queryByText('2건 대기')).toBeNull();
    fireEvent.press((await findAllByLabelText('환불 요청 확인'))[0]);
    expect(navigation.navigate).toHaveBeenCalledWith('BusinessEscrowDetail', { id: 'e-needs-response' });
  });

  it('should surface completed refunds above the active merchant list', async () => {
    const { api } = require('../../api/client');
    const navigation = { navigate: jest.fn() };
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 100,
      totalPending: 0,
      summary: {
        receivedAmount: 100,
        protectedPendingAmount: 0,
        pendingApprovalAmount: 0,
        activeEscrowCount: 0,
        refundActionRequiredCount: 0,
        refundMonitoringCount: 0,
        refundCompletedCount: 1,
        dueSettlementCount: 0,
        dueSettlementAmount: 0,
      },
      escrows: [
        {
          id: 'e-refunded-business-home',
          status: 'cancelled',
          escrowType: 'prepaid',
          totalAmount: 400,
          monthlyAmount: 100,
          months: 4,
          consumer: { id: 'consumer-1', name: '김민수' },
          entries: [
            { id: 'en-1', amount: '100', status: 'released' },
            { id: 'en-2', amount: '100', status: 'refunded', txHash: 'REFUND_2' },
            { id: 'en-3', amount: '100', status: 'refunded', txHash: 'REFUND_3' },
            { id: 'en-4', amount: '100', status: 'refunded', txHash: 'REFUND_4' },
          ],
          chargeRequests: [],
          refundReviewRequests: [
            {
              id: 'review-refunded-business-home',
              status: 'refunded',
              refundableAmount: 300,
              requestedAt: '2026-05-14T00:00:00.000Z',
              resolvedAt: '2026-05-17T00:00:00.000Z',
            },
          ],
        },
      ],
    });

    const { findByText, queryByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={navigation as any} />);

    expect(await findByText('환불 처리 완료')).toBeTruthy();
    expect(await findByText('김민수 · 소비자에게 미사용분 환불 완료 ₩405,000')).toBeTruthy();
    expect(await findByText('환불 완료 확인')).toBeTruthy();
    expect(queryByText('김민수', { exact: true })).toBeNull();
  });

  it('should provide pending QR actions and accessible search controls', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 0,
      summary: {
        receivedAmount: 0,
        protectedPendingAmount: 0,
        pendingApprovalAmount: 222.222222,
        activeEscrowCount: 0,
        refundActionRequiredCount: 0,
        refundMonitoringCount: 0,
        refundCompletedCount: 0,
        dueSettlementCount: 0,
        dueSettlementAmount: 0,
      },
      escrows: [],
      pendingPaymentRequests: [
        {
          id: 'request-1',
          code: 'TP-000001',
          businessId: 'business-1',
          businessName: '파워짐',
          paymentAmount: 222.222222,
          totalAmount: 244.444444,
          paymentModel: 'voucher',
          escrowType: 'prepaid',
          validFrom: '2026-05-15',
          validUntil: '2026-07-22',
          status: 'pending',
          createdAt: '2026-05-15T00:00:00.000Z',
        },
      ],
    });

    const { findAllByText, findByLabelText, findByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    expect((await findAllByText('승인 대기 QR')).length).toBeGreaterThan(0);
    expect(await findByText('승인 대기 총액')).toBeTruthy();
    expect(await findByText('코드 복사')).toBeTruthy();
    expect(await findByText('QR 취소')).toBeTruthy();
    expect(await findByLabelText('소비자 이름 검색')).toBeTruthy();
    expect(await findByLabelText('결제 코드 TP-000001 복사')).toBeTruthy();
    fireEvent.press(await findByLabelText('결제 QR TP-000001 취소'));
    expect(await findByText('QR 결제 취소')).toBeTruthy();
    fireEvent.press(await findByLabelText('QR 취소하기'));
    await waitFor(() => expect(api.cancelPaymentRequest).toHaveBeenCalledWith('request-1'));
  });

  it('should show an empty state that matches search results', async () => {
    const { api } = require('../../api/client');
    api.getBusinessDashboard.mockResolvedValue({
      totalReceived: 0,
      totalPending: 600,
      escrows: [
        {
          id: 'e-search',
          status: 'active',
          escrowType: 'monthly',
          totalAmount: 600,
          monthlyAmount: 100,
          months: 6,
          consumer: { id: 'consumer-1', name: '김민수' },
          entries: [
            { id: 'en-1', month: 1, amount: '100', status: 'pending', finishAfter: 830607775 },
          ],
        },
      ],
    });

    const { findByLabelText, findByText, queryByText } = renderWithProviders(<BusinessDashboardScreen route={{} as any} navigation={{} as any} />);

    fireEvent.changeText(await findByLabelText('소비자 이름 검색'), '없는고객');

    expect(await findByText('검색 결과가 없습니다')).toBeTruthy();
    expect(await findByText('다른 고객 이름으로 다시 검색해보세요')).toBeTruthy();
    expect(queryByText('활성 보호 결제가 없습니다')).toBeNull();
  });
});
