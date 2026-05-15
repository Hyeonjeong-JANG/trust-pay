import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileScreen } from './ProfileScreen';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

jest.mock('../../api/client', () => ({
  api: { getBalance: jest.fn().mockResolvedValue({ xrplAddress: 'rTest12345678', balance: '5000' }) },
}));

const mockClearAuth = jest.fn();
jest.mock('../../store/auth', () => ({
  useAuthStore: (selector: any) =>
    selector({ role: 'consumer', userId: 'c-1', name: '김테스트', clearAuth: mockClearAuth }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const clearQueryCache = jest.spyOn(qc, 'clear');
  const result = render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  return { ...result, clearQueryCache };
}

beforeEach(() => jest.clearAllMocks());

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

  it('should show an in-app modal after copying the XRPL address', async () => {
    const Clipboard = require('expo-clipboard');
    const { findByText } = renderWithProviders(<ProfileScreen navigation={{} as any} route={{} as any} />);

    fireEvent.press(await findByText('주소 복사'));

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('rTest12345678');
    });
    expect(await findByText('복사됨')).toBeTruthy();
    expect(await findByText('XRPL 주소가 클립보드에 복사되었습니다.')).toBeTruthy();
  });

  it('should render app info section', async () => {
    const { findAllByText, findByText } = renderWithProviders(<ProfileScreen navigation={{} as any} route={{} as any} />);
    expect(await findByText('XRPL Testnet')).toBeTruthy();
    expect((await findAllByText('XRPL 보호 원장')).length).toBeGreaterThan(0);
    expect(await findByText(/보호 원장 증빙용 RLUSD와 Testnet 주소를 확인/)).toBeTruthy();
  });

  it('should keep logout inside the profile screen', async () => {
    const { findByText, clearQueryCache } = renderWithProviders(<ProfileScreen navigation={{} as any} route={{} as any} />);

    fireEvent.press(await findByText('로그아웃'));

    await waitFor(() => {
      expect(clearQueryCache).toHaveBeenCalled();
      expect(mockClearAuth).toHaveBeenCalled();
    });
  });
});
