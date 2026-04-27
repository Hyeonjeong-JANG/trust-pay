import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConsumerDashboardScreen } from './DashboardScreen';

// Mock API
jest.mock('../../api/client', () => ({
  api: {
    getConsumerEscrows: jest.fn(),
    getBalance: jest.fn().mockResolvedValue({ xrplAddress: 'rTest1234', balance: '10000' }),
  },
}));

// Mock auth store
jest.mock('../../store/auth', () => ({
  useAuthStore: (selector: any) =>
    selector({ role: 'consumer', userId: 'consumer-1', name: '테스트' }),
}));

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
} as any;

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('ConsumerDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render title after loading', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);

    const { findByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );
    expect(await findByText('내 선불 보호')).toBeTruthy();
  });

  it('should show FAB button after loading', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);

    const { findByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );
    expect(await findByText('+')).toBeTruthy();
  });

  it('should show empty state message when no escrows', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([]);

    const { findByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('에스크로가 없습니다')).toBeTruthy();
  });

  it('should render escrow cards with business name and amount', async () => {
    const { api } = require('../../api/client');
    api.getConsumerEscrows.mockResolvedValue([
      {
        id: 'e-1',
        totalAmount: 150000,
        months: 3,
        status: 'active',
        business: { name: '테스트카페' },
        entries: [
          { status: 'released' },
          { status: 'pending' },
          { status: 'pending' },
        ],
      },
    ]);

    const { findByText } = renderWithProviders(
      <ConsumerDashboardScreen navigation={mockNavigation} route={{} as any} />,
    );

    expect(await findByText('테스트카페')).toBeTruthy();
    expect(await findByText('1/3개월 릴리즈됨')).toBeTruthy();
  });
});
