import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from './auth';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(null),
  },
}));

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      role: null,
      userId: null,
      name: null,
      token: null,
    });
  });

  it('should persist auth data so refresh keeps the user logged in', () => {
    useAuthStore.getState().setAuth('consumer', 'consumer-1', '김민수', 'demo-token');

    expect(useAuthStore.getState()).toMatchObject({
      role: 'consumer',
      userId: 'consumer-1',
      name: '김민수',
      token: 'demo-token',
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'trust-pay-auth',
      expect.stringContaining('consumer-1'),
    );
  });
});
