import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BusinessEscrowDetailScreen } from './BusinessEscrowDetailScreen';

jest.mock('../../api/client', () => ({
  api: {
    getEscrow: jest.fn(),
    createChargeRequest: jest.fn(),
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
    expect(await findByText(/원장 증빙: MONTH_1_TX/)).toBeTruthy();
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
});
