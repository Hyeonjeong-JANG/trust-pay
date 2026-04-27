import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileScreen } from './ProfileScreen';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

jest.mock('../../api/client', () => ({
  api: { getBalance: jest.fn().mockResolvedValue({ xrplAddress: 'rTest12345678', balance: '5000' }) },
}));

jest.mock('../../store/auth', () => ({
  useAuthStore: (selector: any) =>
    selector({ role: 'consumer', userId: 'c-1', name: '김테스트' }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ProfileScreen', () => {
  it('should render user name and role', async () => {
    const { findByText } = renderWithProviders(<ProfileScreen navigation={{} as any} route={{} as any} />);
    expect(await findByText('김테스트')).toBeTruthy();
    expect(await findByText('소비자')).toBeTruthy();
  });

  it('should render balance and XRPL address', async () => {
    const { findByText } = renderWithProviders(<ProfileScreen navigation={{} as any} route={{} as any} />);
    expect(await findByText('5,000 RLUSD')).toBeTruthy();
    expect(await findByText('주소 복사')).toBeTruthy();
  });

  it('should render app info section', async () => {
    const { findByText } = renderWithProviders(<ProfileScreen navigation={{} as any} route={{} as any} />);
    expect(await findByText('XRPL Testnet')).toBeTruthy();
    expect(await findByText('Token Escrow (XLS-85)')).toBeTruthy();
  });
});
