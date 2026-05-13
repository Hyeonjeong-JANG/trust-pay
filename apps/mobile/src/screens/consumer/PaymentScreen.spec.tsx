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

  it('should explain the monthly Token Escrow structure', () => {
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
    expect(getByText(/총액은 6개의 Token Escrow로 나뉘어 잠기고/)).toBeTruthy();
  });

  it('should convert KRW input to decimal RLUSD before creating an escrow', async () => {
    const { api } = require('../../api/client');
    const { getByPlaceholderText, getByText } = renderWithProviders(
      <PaymentScreen
        navigation={{ navigate: jest.fn() } as any}
        route={{ params: { businessId: 'b-1', businessName: '파워짐 헬스장' } } as any}
      />,
    );

    fireEvent.changeText(getByPlaceholderText('예: 810,000'), '1000');
    fireEvent.changeText(getByPlaceholderText('예: 6'), '1');
    fireEvent.press(getByText('에스크로 생성'));

    await waitFor(() => expect(api.createEscrow).toHaveBeenCalled());
    const payload = api.createEscrow.mock.calls[0][0];
    expect(payload.totalAmount).toBeCloseTo(0.740741, 6);
    expect(payload.months).toBe(1);
  });

  it('should normalize prepaid decimal RLUSD total from the KRW unit count', async () => {
    const { api } = require('../../api/client');
    const { getByPlaceholderText, getByText } = renderWithProviders(
      <PaymentScreen
        navigation={{ navigate: jest.fn() } as any}
        route={{ params: { businessId: 'b-1', businessName: '강남 블루보틀', businessCategory: '카페' } } as any}
      />,
    );

    fireEvent.changeText(getByPlaceholderText('예: 202,500'), '30000');
    fireEvent.changeText(getByPlaceholderText('예: 6,750'), '1000');
    fireEvent.changeText(getByPlaceholderText('예: 3'), '3');
    fireEvent.press(getByText('에스크로 생성'));

    await waitFor(() => expect(api.createEscrow).toHaveBeenCalled());
    const payload = api.createEscrow.mock.calls[0][0];
    expect(payload.unitPrice).toBeCloseTo(0.740741, 6);
    expect(payload.totalAmount).toBeCloseTo(22.22223, 6);
  });

  it('should default cafe payments to prepaid vouchers', () => {
    const { getAllByText, getByPlaceholderText, getByText } = renderWithProviders(
      <PaymentScreen
        navigation={{ navigate: jest.fn() } as any}
        route={{ params: { businessId: 'b-1', businessName: '강남 블루보틀', businessCategory: '카페' } } as any}
      />,
    );

    fireEvent.changeText(getByPlaceholderText('예: 202,500'), '202500');
    fireEvent.changeText(getByPlaceholderText('예: 6,750'), '6750');
    fireEvent.changeText(getByPlaceholderText('예: 3'), '3');

    expect(getByText('이용권')).toBeTruthy();
    expect(getByText('30개 단위 x ₩6,750')).toBeTruthy();
    expect(getAllByText('5.00 RLUSD').length).toBeGreaterThan(0);
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
      expect(getByText(/메뉴 금액만큼 여러 Token Escrow 단위/)).toBeTruthy();
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
      expect(getByText(/월별 릴리즈 금액/)).toBeTruthy();
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
    const { findByText, getByText } = renderWithProviders(
      <PaymentScreen
        navigation={{ navigate } as any}
        route={{ params: { businessId: 'b-1', businessName: '헤어살롱 루나', businessCategory: '미용실' } } as any}
      />,
    );

    fireEvent.press(await findByText('헤어살롱 루나 선불권'));
    expect(await findByText('커트 ₩40,500')).toBeTruthy();
    expect(await findByText('클리닉 ₩67,500')).toBeTruthy();
    fireEvent.press(getByText('에스크로 생성'));

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
});
