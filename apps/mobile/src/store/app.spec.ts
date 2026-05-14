import { useAppStore } from './app';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(null),
  },
}));

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      hasSeenOnboarding: false,
      notificationsLastViewed: 0,
      realtimeNotificationSeenIds: [],
    });
  });

  it('should have correct default values', () => {
    const state = useAppStore.getState();
    expect(state.hasSeenOnboarding).toBe(false);
    expect(state.notificationsLastViewed).toBe(0);
    expect(state.realtimeNotificationSeenIds).toEqual([]);
  });

  it('should update hasSeenOnboarding', () => {
    useAppStore.getState().setHasSeenOnboarding(true);
    expect(useAppStore.getState().hasSeenOnboarding).toBe(true);
  });

  it('should update hasSeenOnboarding back to false', () => {
    useAppStore.getState().setHasSeenOnboarding(true);
    useAppStore.getState().setHasSeenOnboarding(false);
    expect(useAppStore.getState().hasSeenOnboarding).toBe(false);
  });

  it('should update notificationsLastViewed', () => {
    const now = Date.now();
    useAppStore.getState().setNotificationsLastViewed(now);
    expect(useAppStore.getState().notificationsLastViewed).toBe(now);
  });

  it('should persist setters correctly', () => {
    const state = useAppStore.getState();
    expect(typeof state.setHasSeenOnboarding).toBe('function');
    expect(typeof state.setNotificationsLastViewed).toBe('function');
    expect(typeof state.markRealtimeNotificationSeen).toBe('function');
  });

  it('should remember realtime notification ids without duplicates', () => {
    useAppStore.getState().markRealtimeNotificationSeen('business-charge-1');
    useAppStore.getState().markRealtimeNotificationSeen('business-charge-1');
    useAppStore.getState().markRealtimeNotificationSeen('business-charge-2');

    expect(useAppStore.getState().realtimeNotificationSeenIds).toEqual([
      'business-charge-1',
      'business-charge-2',
    ]);
  });
});
