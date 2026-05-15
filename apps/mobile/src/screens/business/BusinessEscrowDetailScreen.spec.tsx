import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessEscrowDetailScreen } from './BusinessEscrowDetailScreen';

jest.mock('../../api/client', () => ({
  api: {
    getEscrow: jest.fn(),
    createChargeRequest: jest.fn(),
    respondToRefundReviewRequest: jest.fn(),
  },
}));

jest.mock('../../utils/toast', () => ({
  showSuccessToast: jest.fn(),
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
    expect(await findByText('XRPL Testnet 증빙')).toBeTruthy();
    expect(await findByText('MONTH_1_TX')).toBeTruthy();
  });

  it('should show prepaid validity and hide internal ledger units for the merchant', async () => {
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

    const { findByText, queryByText } = renderWithProviders(
      <BusinessEscrowDetailScreen route={{ params: { id: 'e-prepaid-business' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('고객 이서연')).toBeTruthy();
    expect(await findByText(/사용기한 2026\. 5\. 13\. ~ 2026\. 8\. 13\./)).toBeTruthy();
    expect(await findByText('차감 내역')).toBeTruthy();
    expect(await findByText('아직 차감 내역이 없습니다')).toBeTruthy();
    expect(queryByText('보호 원장 내역')).toBeNull();
    expect(queryByText('보호 원장 항목 1')).toBeNull();
    expect(queryByText(/만료:/)).toBeNull();
  });

  it('should show settled charge history with KRW first and RLUSD as secondary detail', async () => {
    const { api } = require('../../api/client');
    api.getEscrow.mockResolvedValue({
      id: 'e-prepaid-charge-history',
      status: 'active',
      escrowType: 'prepaid',
      totalAmount: 150,
      monthlyAmount: 5,
      unitPrice: 5,
      months: 30,
      business: { name: '강남 블루보틀' },
      consumer: { name: '이서연' },
      entries: [],
      chargeRequests: [
        { id: 'charge-1', menuName: '아메리카노', amount: 5, status: 'settled', requestedAt: '2026-05-13T00:00:00.000Z', settledAt: '2026-05-13T00:00:00.000Z' },
      ],
    });

    const { findByText } = renderWithProviders(
      <BusinessEscrowDetailScreen route={{ params: { id: 'e-prepaid-charge-history' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('아메리카노 ₩6,750')).toBeTruthy();
    expect(await findByText('₩6,750')).toBeTruthy();
    expect(await findByText('5.00 RLUSD')).toBeTruthy();
  });

  it('should send prepaid charge requests from the detail screen using a selected menu', async () => {
    const { api } = require('../../api/client');
    api.createChargeRequest.mockResolvedValue({ id: 'charge-menu', status: 'pending_approval' });
    api.getEscrow.mockResolvedValue({
      id: 'e-prepaid-menu-detail',
      status: 'active',
      escrowType: 'prepaid',
      totalAmount: 74.074074,
      monthlyAmount: 7.407407,
      unitPrice: 7.407407,
      months: 10,
      validFrom: '2026-05-13',
      validUntil: '2026-08-13',
      business: { name: '강남 블루보틀' },
      consumer: { name: '이서연' },
      product: {
        id: 'product-cafe',
        businessId: 'business-1',
        name: '카페 금액권',
        escrowType: 'prepaid',
        totalAmount: 74.074074,
        monthlyAmount: 7.407407,
        menuItems: [
          { id: 'menu-americano', productId: 'product-cafe', name: '아메리카노', amount: 3.703704 },
          { id: 'menu-brunch', productId: 'product-cafe', name: '브런치 세트', amount: 14.814815 },
        ],
      },
      entries: [
        { id: 'en-1', month: 1, amount: '7.407407', status: 'pending', finishAfter: 830607775, cancelAfter: 837000000 },
      ],
    });

    const { findAllByText, findByText } = renderWithProviders(
      <BusinessEscrowDetailScreen route={{ params: { id: 'e-prepaid-menu-detail' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('고객 이용분 승인 요청')).toBeTruthy();
    fireEvent.press(await findByText('차감 항목 선택'));
    const americanoOptions = await findAllByText('아메리카노 · ₩5,000');
    fireEvent.press(americanoOptions[americanoOptions.length - 1]);
    fireEvent.press(await findByText('선택 항목 승인 요청'));

    await waitFor(() => {
      expect(api.createChargeRequest).toHaveBeenCalledWith('e-prepaid-menu-detail', {
        menuItemId: 'menu-americano',
      });
      const { showSuccessToast } = require('../../utils/toast');
      expect(showSuccessToast).toHaveBeenCalledWith('이용분 승인 요청 전송', '소비자 승인 대기 상태로 등록되었습니다.');
    });
  });

  it('should allow variable prepaid direct charge amounts without unit multiple validation', async () => {
    const { api } = require('../../api/client');
    api.createChargeRequest.mockResolvedValue({ id: 'charge-direct', status: 'pending_approval' });
    api.getEscrow.mockResolvedValue({
      id: 'e-prepaid-variable-detail',
      status: 'active',
      escrowType: 'prepaid',
      totalAmount: 814.81481,
      monthlyAmount: 81.481481,
      unitPrice: 81.481481,
      months: 10,
      business: { name: '파워짐 피트니스' },
      consumer: { name: '김민수' },
      entries: [
        { id: 'en-1', month: 1, amount: '81.481481', status: 'pending', finishAfter: 830607775, cancelAfter: 837000000 },
      ],
    });

    const { findByPlaceholderText, findByText, queryByText } = renderWithProviders(
      <BusinessEscrowDetailScreen route={{ params: { id: 'e-prepaid-variable-detail' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('고객 이용분 승인 요청')).toBeTruthy();
    fireEvent.changeText(await findByPlaceholderText('예: 수건 대여'), '수건 대여');
    fireEvent.changeText(await findByPlaceholderText('예: 67,500'), '67500');
    fireEvent.press(await findByText('직접 입력 승인 요청'));

    await waitFor(() => {
      expect(queryByText(/₩110,000 단위/)).toBeNull();
      expect(api.createChargeRequest).toHaveBeenCalledWith('e-prepaid-variable-detail', {
        menuName: '수건 대여',
        amount: 50,
      });
    });
  });

  it('should show admin-requested refund review details to the merchant', async () => {
    const { api } = require('../../api/client');
    api.getEscrow.mockResolvedValue({
      id: 'e-prepaid-refund-detail',
      status: 'active',
      escrowType: 'prepaid',
      totalAmount: 150,
      monthlyAmount: 5,
      unitPrice: 5,
      months: 30,
      business: { name: '강남 블루보틀' },
      consumer: { name: '이서연' },
      entries: [
        { id: 'en-1', month: 1, amount: '5', status: 'pending', finishAfter: 830607775, cancelAfter: 837000000 },
      ],
      chargeRequests: [],
      refundReviewRequests: [
        {
          id: 'refund-review-1',
          status: 'merchant_response_requested',
          refundableAmount: 10,
          merchantRespondBy: '2026-05-18T00:00:00.000Z',
          merchantNotice: '고객이 장기 휴업을 주장했습니다. 영업 가능 여부와 이용권 처리 방안을 답변해주세요.',
          requestedAt: '2026-05-14T00:00:00.000Z',
        },
      ],
    });

    const { findByText } = renderWithProviders(
      <BusinessEscrowDetailScreen route={{ params: { id: 'e-prepaid-refund-detail' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('환불 검토 요청 접수됨')).toBeTruthy();
    expect(await findByText('사업자 답변 대기')).toBeTruthy();
    expect(await findByText(/환불 검토 금액 ₩13,500/)).toBeTruthy();
    expect(await findByText(/사업자 답변 기한 2026\. 5\. 18\./)).toBeTruthy();
    expect(await findByText(/고객이 장기 휴업을 주장했습니다/)).toBeTruthy();
  });

  it('should submit a merchant refund review response', async () => {
    const { api } = require('../../api/client');
    api.getEscrow.mockResolvedValue({
      id: 'e-prepaid-refund-response',
      status: 'active',
      escrowType: 'prepaid',
      totalAmount: 150,
      monthlyAmount: 5,
      unitPrice: 5,
      months: 30,
      business: { name: '강남 블루보틀' },
      consumer: { name: '이서연' },
      entries: [{ id: 'en-1', month: 1, amount: '5', status: 'pending', finishAfter: 830607775, cancelAfter: 837000000 }],
      chargeRequests: [],
      refundReviewRequests: [
        {
          id: 'refund-review-response',
          status: 'merchant_response_requested',
          refundableAmount: 10,
          merchantRespondBy: '2026-05-18T00:00:00.000Z',
          merchantNotice: '고객이 장기 휴업을 주장했습니다. 영업 가능 여부와 이용권 처리 방안을 답변해주세요.',
          requestedAt: '2026-05-14T00:00:00.000Z',
        },
      ],
    });
    api.respondToRefundReviewRequest.mockResolvedValue({ id: 'refund-review-response', status: 'merchant_responded' });

    const { findByPlaceholderText, findByText } = renderWithProviders(
      <BusinessEscrowDetailScreen route={{ params: { id: 'e-prepaid-refund-response' } } as any} navigation={{} as any} />,
    );

    fireEvent.changeText(await findByPlaceholderText('TrustPay에 전달할 답변 내용을 입력해주세요'), '현재 리모델링 중이며 다음 주부터 이용 가능합니다. 미사용분 환불 협의 가능합니다.');
    fireEvent.press(await findByText('답변 제출'));

    await waitFor(() => expect(api.respondToRefundReviewRequest).toHaveBeenCalledWith('refund-review-response', {
      response: '현재 리모델링 중이며 다음 주부터 이용 가능합니다. 미사용분 환불 협의 가능합니다.',
    }));
  });

  it('should surface platform-review refund status without consumer evidence in merchant detail', async () => {
    const { api } = require('../../api/client');
    api.getEscrow.mockResolvedValue({
      id: 'e-prepaid-platform-review',
      status: 'active',
      escrowType: 'prepaid',
      totalAmount: 150,
      monthlyAmount: 5,
      unitPrice: 5,
      months: 30,
      business: { name: '강남 블루보틀' },
      consumer: { name: '이서연' },
      entries: [{ id: 'en-1', month: 1, amount: '5', status: 'pending', finishAfter: 830607775, cancelAfter: 837000000 }],
      chargeRequests: [],
      refundReviewRequests: [
        {
          id: 'refund-review-platform',
          status: 'platform_review',
          refundableAmount: 10,
          merchantRespondBy: '2026-05-18T00:00:00.000Z',
          consumerReason: '2주 넘게 안 열고 전화도 받지 않아 환불 검토를 요청합니다.',
          photoDataUrls: ['data:image/png;base64,ZmFrZQ=='],
          requestedAt: '2026-05-14T00:00:00.000Z',
        },
      ],
    });

    const { findByText, queryByText } = renderWithProviders(
      <BusinessEscrowDetailScreen route={{ params: { id: 'e-prepaid-platform-review' } } as any} navigation={{} as any} />,
    );

    expect(await findByText(/강남 블루보틀/)).toBeTruthy();
    expect(await findByText('환불 검토 요청 접수됨')).toBeTruthy();
    expect(await findByText('TrustPay 확인 중')).toBeTruthy();
    expect(queryByText(/2주 넘게 안 열고 전화도 안/)).toBeNull();
    expect(queryByText('첨부 사진 1장')).toBeNull();
  });

  it('should surface merchant-review refund status without consumer evidence in merchant detail', async () => {
    const { api } = require('../../api/client');
    api.getEscrow.mockResolvedValue({
      id: 'e-prepaid-merchant-review',
      status: 'active',
      escrowType: 'prepaid',
      totalAmount: 150,
      monthlyAmount: 5,
      unitPrice: 5,
      months: 30,
      business: { name: '강남 블루보틀' },
      consumer: { name: '김민수' },
      entries: [{ id: 'en-1', month: 1, amount: '5', status: 'pending', finishAfter: 830607775, cancelAfter: 837000000 }],
      chargeRequests: [],
      refundReviewRequests: [
        {
          id: 'refund-review-merchant',
          status: 'platform_investigation',
          refundableAmount: 10,
          merchantRespondBy: '2026-05-18T00:00:00.000Z',
          consumerReason: '2주 넘게 문을 열지 않아 환불 검토를 요청합니다.',
          photoDataUrls: ['data:image/png;base64,ZmFrZQ=='],
          requestedAt: '2026-05-14T00:00:00.000Z',
        },
      ],
    });

    const { findByText, queryByText } = renderWithProviders(
      <BusinessEscrowDetailScreen route={{ params: { id: 'e-prepaid-merchant-review' } } as any} navigation={{} as any} />,
    );

    expect(await findByText('환불 검토 요청 접수됨')).toBeTruthy();
    expect(await findByText('TrustPay 추가 확인 중')).toBeTruthy();
    expect(queryByText(/2주 넘게 문을 열지 않아/)).toBeNull();
    expect(queryByText('첨부 사진 1장')).toBeNull();
  });
});
