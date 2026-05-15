import React from 'react';
import { cleanup, render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentScreen } from './PaymentScreen';

jest.mock('../../utils/toast', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../../api/client', () => ({
  api: { createEscrow: jest.fn(), getBusinessProducts: jest.fn() },
}));

jest.mock('../../store/auth', () => ({
  useAuthStore: (selector: any) => selector({ userId: 'consumer-1' }),
}));

const queryClients: QueryClient[] = [];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  queryClients.push(queryClient);
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

async function enterApprovalPin(screen: { findByPlaceholderText: (text: string) => Promise<any>; findByText: (text: string) => Promise<any> }) {
  fireEvent.changeText(await screen.findByPlaceholderText('간편비밀번호 6자리'), '123456');
  fireEvent.press(await screen.findByText('간편비밀번호로 승인'));
}

describe('PaymentScreen', () => {
  beforeEach(() => {
    const { api } = require('../../api/client');
    api.createEscrow.mockResolvedValue({ id: 'escrow-created' });
    api.getBusinessProducts.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
    queryClients.forEach((client) => client.clear());
    queryClients.length = 0;
    jest.clearAllMocks();
  });

  it('should explain the monthly protected ledger structure', () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(
      <PaymentScreen
        navigation={{ navigate: jest.fn() } as any}
        route={{ params: { businessId: 'b-1', businessName: '파워짐 헬스장' } } as any}
      />,
    );

    fireEvent.changeText(getByPlaceholderText('예: 810,000'), '810000');
    fireEvent.changeText(getByPlaceholderText('예: 6'), '6');

    expect(getByText('월 ₩135,000')).toBeTruthy();
    expect(getByText('100.00 RLUSD')).toBeTruthy();
    expect(getByText(/총액은 6개월로 나뉘어 보호 원장에 보관되고/)).toBeTruthy();
  });

  it('should explain account-approved TrustPay checkout as the main protected payment path', () => {
    const { getByText } = renderWithProviders(
      <PaymentScreen
        navigation={{ navigate: jest.fn() } as any}
        route={{ params: { businessId: 'b-1', businessName: '파워짐 헬스장' } } as any}
      />,
    );

    expect(getByText('TrustPay 계좌 승인으로 결제')).toBeTruthy();
    expect(getByText(/연결 계좌에서 앱 승인 후 선불금이 XRPL 보호 원장에 잠깁니다/)).toBeTruthy();
    expect(getByText(/카드는 보조 옵션이며 현금이나 가게 단말기 직접 결제는 보호 대상이 아닙니다/)).toBeTruthy();
  });

  it('should convert KRW input to decimal RLUSD before creating an escrow', async () => {
    const { api } = require('../../api/client');
    const { findByPlaceholderText, findByText, getByPlaceholderText, getByText } = renderWithProviders(
      <PaymentScreen
        navigation={{ navigate: jest.fn() } as any}
        route={{ params: { businessId: 'b-1', businessName: '파워짐 헬스장' } } as any}
      />,
    );

    fireEvent.changeText(getByPlaceholderText('예: 810,000'), '1000');
    fireEvent.changeText(getByPlaceholderText('예: 6'), '1');
    fireEvent.press(getByText('계좌 승인 결제 요청'));
    expect(api.createEscrow).not.toHaveBeenCalled();
    await enterApprovalPin({ findByPlaceholderText, findByText });

    await waitFor(() => expect(api.createEscrow).toHaveBeenCalled());
    const payload = api.createEscrow.mock.calls[0][0];
    expect(payload.totalAmount).toBeCloseTo(0.740741, 6);
    expect(payload.months).toBe(1);
  });

  it('should normalize prepaid decimal RLUSD total from the KRW unit count', async () => {
    const { api } = require('../../api/client');
    const { findByPlaceholderText, findByText, getByPlaceholderText, getByText } = renderWithProviders(
      <PaymentScreen
        navigation={{ navigate: jest.fn() } as any}
        route={{ params: { businessId: 'b-1', businessName: '강남 블루보틀', businessCategory: '카페' } } as any}
      />,
    );

    fireEvent.changeText(getByPlaceholderText('예: 202,500'), '30000');
    fireEvent.changeText(getByPlaceholderText('예: 6,750'), '1000');
    fireEvent.changeText(getByPlaceholderText('예: 3'), '3');
    fireEvent.press(getByText('계좌 승인 결제 요청'));
    expect(api.createEscrow).not.toHaveBeenCalled();
    await enterApprovalPin({ findByPlaceholderText, findByText });

    await waitFor(() => expect(api.createEscrow).toHaveBeenCalled());
    const payload = api.createEscrow.mock.calls[0][0];
    expect(payload.unitPrice).toBeCloseTo(0.740741, 6);
    expect(payload.totalAmount).toBeCloseTo(22.22223, 6);
  });

  it('should default cafe payments to period vouchers without exposing fixed units', () => {
    const { getByPlaceholderText, getByText, queryByText } = renderWithProviders(
      <PaymentScreen
        navigation={{ navigate: jest.fn() } as any}
        route={{ params: { businessId: 'b-1', businessName: '강남 블루보틀', businessCategory: '카페' } } as any}
      />,
    );

    fireEvent.changeText(getByPlaceholderText('예: 202,500'), '202500');
    fireEvent.changeText(getByPlaceholderText('예: 6,750'), '6750');
    fireEvent.changeText(getByPlaceholderText('예: 3'), '3');

    expect(getByText('이용권')).toBeTruthy();
    expect(getByText('보호 금액권 잔액')).toBeTruthy();
    expect(getByText('₩202,500')).toBeTruthy();
    expect(queryByText('30개 단위 x ₩6,750')).toBeNull();
    expect(queryByText(/Token Escrow 단위/)).toBeNull();
    expect(getByText(/유효기간: 3개월/)).toBeTruthy();
  });

  it.each(['미용실', '네일샵', '피부관리', '에스테틱', '마사지', '세탁소', '카페', 'PT샵', '골프 레슨', '테니스 레슨'])(
    'should default %s payments to prepaid vouchers',
    (businessCategory) => {
      const { getByText } = renderWithProviders(
        <PaymentScreen
          navigation={{ navigate: jest.fn() } as any}
          route={{ params: { businessId: 'b-1', businessName: '타깃 사업자', businessCategory } } as any}
        />,
      );

      expect(getByText('1회 이용금액 (원)')).toBeTruthy();
      expect(getByText('유효기간 (개월)')).toBeTruthy();
      expect(getByText(/실제 사용금액만큼 사업자가 차감 요청/)).toBeTruthy();
    },
  );

  it.each(['헬스장', '피트니스', '학원', '어학원', '독서실', '스터디카페', '필라테스', '요가'])(
    'should default %s payments to monthly escrow',
    (businessCategory) => {
      const { getByText } = renderWithProviders(
        <PaymentScreen
          navigation={{ navigate: jest.fn() } as any}
          route={{ params: { businessId: 'b-1', businessName: '타깃 사업자', businessCategory } } as any}
        />,
      );

      expect(getByText('기간 (개월)')).toBeTruthy();
      expect(getByText(/월별 정산 금액/)).toBeTruthy();
    },
  );

  it('should create escrow from a selected business product', async () => {
    const { api } = require('../../api/client');
    api.getBusinessProducts.mockReturnValue([
      {
        id: 'product-salon',
        businessId: 'b-1',
        name: '헤어살롱 루나 선불권',
        description: '메뉴별 차감 선불권',
        escrowType: 'prepaid',
        totalAmount: 300,
        monthlyAmount: 10,
        months: 30,
        unitPrice: 10,
        validityMonths: 6,
        menuItems: [
          { id: 'menu-cut', productId: 'product-salon', name: '커트', amount: 30 },
          { id: 'menu-clinic', productId: 'product-salon', name: '클리닉', amount: 50 },
        ],
      },
    ]);

    const navigate = jest.fn();
    const { findByPlaceholderText, findByText, getByText, queryByText } = renderWithProviders(
      <PaymentScreen
        navigation={{ navigate } as any}
        route={{ params: { businessId: 'b-1', businessName: '헤어살롱 루나', businessCategory: '미용실' } } as any}
      />,
    );

    fireEvent.press(await findByText('헤어살롱 루나 선불권'));
    expect(await findByText('커트 ₩40,500')).toBeTruthy();
    expect(await findByText('클리닉 ₩67,500')).toBeTruthy();
    expect(queryByText(/단위 보호/)).toBeNull();
    fireEvent.press(getByText('계좌 승인 결제 요청'));
    expect(api.createEscrow).not.toHaveBeenCalled();
    await enterApprovalPin({ findByPlaceholderText, findByText });

    await waitFor(() => {
      expect(api.createEscrow).toHaveBeenCalledWith({
        consumerId: 'consumer-1',
        businessId: 'b-1',
        productId: 'product-salon',
        totalAmount: 300,
        escrowType: 'prepaid',
        unitPrice: 10,
        validityMonths: 6,
      });
      expect(navigate).toHaveBeenCalledWith('ConsumerTabs', { screen: 'Home' });
    });
  });

  it('should create escrow directly from a merchant QR payment request', async () => {
    const { api } = require('../../api/client');
    const navigate = jest.fn();
    const { findByPlaceholderText, findByText, getByText, queryByText } = renderWithProviders(
      <PaymentScreen
        navigation={{ navigate } as any}
        route={{
          params: {
            businessId: 'b-1',
            businessName: '파워짐 피트니스',
            businessCategory: '헬스장',
            paymentRequest: {
              id: 'request-1',
              code: 'TP-123456',
              businessId: 'b-1',
              businessName: '파워짐 피트니스',
              businessCategory: '헬스장',
              paymentAmount: 600,
              totalAmount: 600,
              monthlyAmount: 100,
              months: 6,
              paymentModel: 'monthly',
              escrowType: 'monthly',
              status: 'pending',
              createdAt: '2026-05-13T00:00:00Z',
            },
          },
        } as any}
      />,
    );

    expect(await findByText('사업자가 만든 결제 QR')).toBeTruthy();
    expect(await findByText('QR 코드 TP-123456')).toBeTruthy();
    expect(await findByText('결제 금액 ₩810,000')).toBeTruthy();
    expect(queryByText('실제 충전 금액 ₩810,000')).toBeNull();
    expect(await findByText('매월 ₩135,000 정산')).toBeTruthy();
    fireEvent.press(getByText('계좌 승인 결제 요청'));
    expect(api.createEscrow).not.toHaveBeenCalled();
    await enterApprovalPin({ findByPlaceholderText, findByText });

    await waitFor(() => {
      expect(api.createEscrow).toHaveBeenCalledWith({
        consumerId: 'consumer-1',
        businessId: 'b-1',
        paymentRequestCode: 'TP-123456',
        totalAmount: 600,
        months: 6,
      });
      expect(navigate).toHaveBeenCalledWith('ConsumerTabs', { screen: 'Home' });
    });
  });

  it('should carry voucher QR validity dates into the created prepaid escrow', async () => {
    const { api } = require('../../api/client');
    const navigate = jest.fn();
    const { findByPlaceholderText, findByText, getByText, queryByText } = renderWithProviders(
      <PaymentScreen
        navigation={{ navigate } as any}
        route={{
          params: {
            businessId: 'b-cafe',
            businessName: '강남 블루보틀',
            businessCategory: '카페',
            paymentRequest: {
              id: 'request-voucher',
              code: 'TP-654321',
              businessId: 'b-cafe',
              businessName: '강남 블루보틀',
              businessCategory: '카페',
              paymentAmount: 66.666667,
              totalAmount: 74.074074,
              paymentModel: 'voucher',
              escrowType: 'prepaid',
              unitPrice: 7.407407,
              validityMonths: 3,
              validFrom: '2026-05-13',
              validUntil: '2026-08-13',
              status: 'pending',
              createdAt: '2026-05-13T00:00:00Z',
            },
          },
        } as any}
      />,
    );

    expect(await findByText('사용기간 2026-05-13 ~ 2026-08-13')).toBeTruthy();
    expect(await findByText('보호 금액권 잔액')).toBeTruthy();
    expect(await findByText('₩100,000')).toBeTruthy();
    expect(queryByText('10개 단위 x ₩10,000')).toBeNull();
    expect(queryByText('보호 단위')).toBeNull();
    expect(queryByText(/Token Escrow 단위/)).toBeNull();
    fireEvent.press(getByText('계좌 승인 결제 요청'));
    expect(api.createEscrow).not.toHaveBeenCalled();
    await enterApprovalPin({ findByPlaceholderText, findByText });

    await waitFor(() => {
      expect(api.createEscrow).toHaveBeenCalledWith({
        consumerId: 'consumer-1',
        businessId: 'b-cafe',
        paymentRequestCode: 'TP-654321',
        totalAmount: 74.07407,
        escrowType: 'prepaid',
        unitPrice: 7.407407,
        validityMonths: 3,
        validFrom: '2026-05-13',
        validUntil: '2026-08-13',
      });
      expect(navigate).toHaveBeenCalledWith('ConsumerTabs', { screen: 'Home' });
    });
  });
});
